// Redondeo y tolerancia utilizados por los cálculos de tarjetas.

export const TOLERANCIA_SALDO =
  0.005;

/**
 * Redondea a centavos.
 */
export function redondearMoneda(
  value:
    number,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
      100,
    ) /
    100
  );
}
