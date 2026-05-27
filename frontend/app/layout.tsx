import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ar-Saude | Qualidade do Ar - São Luís - MA, Brasil',
  description:
    'Painel de monitoramento da qualidade do ar de São Luís - MA, Brasil. Motor de Alertas Ar-Saude.',
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
