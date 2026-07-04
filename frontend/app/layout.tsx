import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ar-Saúde | Monitoramento da Qualidade do Ar no Brasil',
  description:
    'Painel de monitoramento da qualidade do ar em todos os municípios do Brasil. Motor de Alertas Ar-Saúde.',
  icons: {
    icon: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
