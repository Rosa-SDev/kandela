export function dinero(n: number): string {
  return '$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface CifraProps {
  valor: number;
}

export function Cifra({ valor }: CifraProps) {
  return <span className="f-cifra">{dinero(valor)}</span>;
}
