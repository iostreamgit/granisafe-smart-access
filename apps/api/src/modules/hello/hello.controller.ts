import { Controller, Get } from '@nestjs/common';
import { API_PREFIX, APP_NAME, PpeClass, RoleCode } from '@granisafe/shared';

@Controller(`${API_PREFIX.replace(/^\//, '')}/hello`)
export class HelloController {
  @Get()
  hello() {
    return {
      message: `Hello from ${APP_NAME}`,
      phase: 1,
      roles: Object.values(RoleCode),
      ppeClasses: Object.values(PpeClass),
    };
  }
}
