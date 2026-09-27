import styles from './PlaceholderPage.module.css';

type Props = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: Props) {
  return (
    <div className={styles.page}>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className={styles.badge}>Phase 2 shell — module arrives in a later phase</span>
    </div>
  );
}
