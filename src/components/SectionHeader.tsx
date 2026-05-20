interface SectionHeaderProps {
  label: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
}

export default function SectionHeader({ label, title, subtitle, centered = false }: SectionHeaderProps) {
  return (
    <div
      className="fade-up"
      style={{
        textAlign: centered ? 'center' : 'left',
        marginBottom: '3rem',
      }}
    >
      <span className="section-label">{label}</span>

      <h2 className="section-title">
        {title}
      </h2>

      {subtitle && (
        <p
          className="section-desc"
          style={{
            textAlign: centered ? 'center' : 'left',
            marginLeft: centered ? 'auto' : '0',
            marginRight: centered ? 'auto' : '0',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}