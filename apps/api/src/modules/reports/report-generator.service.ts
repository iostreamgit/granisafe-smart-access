import { Injectable } from '@nestjs/common';
import { AccessAttemptStatus } from '@granisafe/shared';
import * as ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../../shared/prisma/prisma.service';

type ReportType = 'ATTENDANCE' | 'REJECTIONS' | 'PPE_COMPLIANCE';
type ReportFormat = 'XLSX' | 'PDF';

type ReportParams = {
  from: string;
  to: string;
  departmentId?: string | null;
};

@Injectable()
export class ReportGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(input: {
    companyId: string;
    type: ReportType;
    format: ReportFormat;
    params: ReportParams;
  }): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
    const rows = await this.loadRows(input.companyId, input.type, input.params);
    if (input.format === 'XLSX') {
      const buffer = await this.toExcel(input.type, rows);
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
    }
    const buffer = await this.toPdf(input.type, rows);
    return { buffer, contentType: 'application/pdf', extension: 'pdf' };
  }

  private async loadRows(
    companyId: string,
    type: ReportType,
    params: ReportParams,
  ): Promise<Record<string, string | number | boolean | null>[]> {
    const from = new Date(params.from);
    const to = new Date(params.to);
    to.setHours(23, 59, 59, 999);

    if (type === 'ATTENDANCE') {
      const records = await this.prisma.attendanceRecord.findMany({
        where: {
          companyId,
          punchedAt: { gte: from, lte: to },
          ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
        },
        include: {
          employee: { include: { department: true } },
        },
        orderBy: { punchedAt: 'asc' },
      });
      return records.map((r) => ({
        employeeCode: r.employee.employeeCode,
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
        department: r.employee.department?.name ?? '',
        punchType: r.punchType,
        punchedAt: r.punchedAt.toISOString(),
        isLate: r.isLate,
        source: r.source,
      }));
    }

    if (type === 'REJECTIONS') {
      const attempts = await this.prisma.accessAttempt.findMany({
        where: {
          companyId,
          status: AccessAttemptStatus.DENIED,
          finishedAt: { gte: from, lte: to },
          ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
        },
        include: {
          employee: { include: { department: true } },
          decision: true,
        },
        orderBy: { finishedAt: 'asc' },
      });
      return attempts.map((a) => ({
        employeeCode: a.employee.employeeCode,
        employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
        department: a.employee.department?.name ?? '',
        accessPoint: a.accessPointCode,
        direction: a.direction,
        finishedAt: a.finishedAt?.toISOString() ?? '',
        reasons: JSON.stringify(a.decision?.reasons ?? []),
      }));
    }

    // PPE_COMPLIANCE
    const detections = await this.prisma.accessDetectionItem.findMany({
      where: {
        accessAttempt: {
          companyId,
          finishedAt: { gte: from, lte: to },
          status: { in: [AccessAttemptStatus.GRANTED, AccessAttemptStatus.DENIED] },
          ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
        },
      },
      include: {
        accessAttempt: {
          include: { employee: { include: { department: true } } },
        },
      },
    });

    const agg = new Map<
      string,
      {
        employeeCode: string;
        employeeName: string;
        department: string;
        ppeClass: string;
        total: number;
        detected: number;
      }
    >();
    for (const d of detections) {
      const emp = d.accessAttempt.employee;
      const key = `${emp.id}:${d.ppeClass}`;
      const cur = agg.get(key) ?? {
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department?.name ?? '',
        ppeClass: d.ppeClass,
        total: 0,
        detected: 0,
      };
      cur.total += 1;
      if (d.detected) cur.detected += 1;
      agg.set(key, cur);
    }
    return [...agg.values()].map((r) => ({
      ...r,
      compliancePct: r.total ? Math.round((r.detected / r.total) * 1000) / 10 : 0,
    }));
  }

  private async toExcel(
    type: string,
    rows: Record<string, string | number | boolean | null>[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(type);
    if (!rows.length) {
      sheet.addRow(['No data for selected range']);
    } else {
      const headers = Object.keys(rows[0]!);
      sheet.addRow(headers);
      for (const row of rows) {
        sheet.addRow(headers.map((h) => row[h] ?? ''));
      }
      sheet.getRow(1).font = { bold: true };
    }
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private toPdf(
    type: string,
    rows: Record<string, string | number | boolean | null>[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text(`Granisafe — ${type.replace(/_/g, ' ')}`, { underline: true });
      doc.moveDown();
      doc.fontSize(9);
      if (!rows.length) {
        doc.text('No data for selected range.');
      } else {
        const headers = Object.keys(rows[0]!);
        for (const row of rows.slice(0, 200)) {
          const line = headers.map((h) => `${h}: ${String(row[h] ?? '')}`).join(' | ');
          doc.text(line, { width: 520 });
          doc.moveDown(0.3);
        }
        if (rows.length > 200) {
          doc.moveDown();
          doc.text(`… ${rows.length - 200} more rows omitted in PDF preview`);
        }
      }
      doc.end();
    });
  }
}
