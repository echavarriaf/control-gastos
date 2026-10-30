// API pública de la cuenta: tipos, validación y cálculos se implementan en expense-account/.

export { EXPENSE_ACCOUNT_ID, EXPENSE_ACCOUNT_DEFAULT_NAME } from "./expense-account/constants";
export type {
  TipoMovimientoCuenta,
  DireccionMovimientoCuenta,
  DireccionMovimientoManualCuenta,
  GuardarMovimientoManualCuentaInput,
  MovimientoManualCuenta,
  MovimientoCuentaGastos,
  EstadoReservaCompromiso,
  ReservaCompromisoCuenta,
  CuentaGastos,
  GuardarCuentaGastosInput,
  SaldoTarjetaCuenta,
  ResumenCuentaGastos,
} from "./expense-account/types";
export { gastoSaleDeCuenta, pagoFijoSaleDeCuenta } from "./expense-account/utils";
export {
  validarCuentaGastos,
  validarMovimientoManualCuenta,
  normalizarMovimientoManualCuenta,
  normalizarCuentaGastos,
} from "./expense-account/validation";
export { calcularResumenCuentaGastos } from "./expense-account/summary";
