"use client";

import {
  CreditCard,
  X,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import CreditCardForm, {
  type CreditCardFormValues,
} from "./CreditCardForm";

import CreditCardsList from "./CreditCardsList";

import type {
  ActualizacionTarjetaCredito,
  NuevaTarjetaCredito,
  TarjetaCredito,
} from "@/lib/budget/types";

interface CreditCardsModalProps {
  abierto: boolean;
  tarjetas: TarjetaCredito[];
  cargando: boolean;
  guardando: boolean;
  actualizandoId: string | null;

  onCerrar: () => void;

  onCrear: (
    datos: NuevaTarjetaCredito,
  ) => Promise<boolean>;

  onActualizar: (
    tarjetaId: string,
    cambios:
      ActualizacionTarjetaCredito,
  ) => Promise<boolean>;

  onCambiarEstado: (
    tarjetaId: string,
    activa: boolean,
  ) => Promise<boolean>;
}

type VistaModal =
  | "lista"
  | "crear"
  | "editar";

/**
 * TARJETAS - 1. Genera un formulario limpio
 * con la fecha actual como punto de partida.
 */
function crearFormularioInicial():
  CreditCardFormValues {
  return {
    nombre: "",
    ultimosCuatro: "",

    saldoInicial: "0",
    fechaSaldoInicial:
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        ),

    diaCorte: "1",
    diaPago: "1",

    estrategiaPago:
      "saldo_completo",

    pagoObjetivo: "",
    limiteCredito: "",

    notas: "",
    activa: true,
  };
}

function formularioDesdeTarjeta(
  tarjeta: TarjetaCredito,
): CreditCardFormValues {
  return {
    nombre:
      tarjeta.nombre,

    ultimosCuatro:
      tarjeta.ultimosCuatro,

    saldoInicial:
      String(
        tarjeta.saldoInicial,
      ),

    fechaSaldoInicial:
      tarjeta.fechaSaldoInicial,

    diaCorte:
      String(
        tarjeta.diaCorte,
      ),

    diaPago:
      String(
        tarjeta.diaPago,
      ),

    estrategiaPago:
      tarjeta.estrategiaPago,

    pagoObjetivo:
      tarjeta.pagoObjetivo ===
      null
        ? ""
        : String(
            tarjeta
              .pagoObjetivo,
          ),

    limiteCredito:
      tarjeta.limiteCredito ===
      null
        ? ""
        : String(
            tarjeta
              .limiteCredito,
          ),

    notas:
      tarjeta.notas,

    activa:
      tarjeta.activa,
  };
}

/**
 * TARJETAS - 2. Convierte y valida los valores
 * del formulario antes de enviarlos al hook.
 */
function convertirFormulario(
  formulario:
    CreditCardFormValues,
): NuevaTarjetaCredito {
  const nombre =
    formulario.nombre.trim();

  if (!nombre) {
    throw new Error(
      "Escribe el nombre de la tarjeta.",
    );
  }

  const ultimosCuatro =
    formulario
      .ultimosCuatro
      .replace(
        /\D/g,
        "",
      );

  if (
    ultimosCuatro &&
    ultimosCuatro.length !== 4
  ) {
    throw new Error(
      "Los últimos cuatro deben contener exactamente cuatro dígitos.",
    );
  }

  const saldoInicial =
    Number(
      formulario
        .saldoInicial,
    );

  if (
    !Number.isFinite(
      saldoInicial,
    ) ||
    saldoInicial < 0
  ) {
    throw new Error(
      "El saldo inicial no puede ser negativo.",
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      formulario
        .fechaSaldoInicial,
    )
  ) {
    throw new Error(
      "Selecciona una fecha válida para el saldo inicial.",
    );
  }

  const diaCorte =
    Number(
      formulario.diaCorte,
    );

  const diaPago =
    Number(
      formulario.diaPago,
    );

  if (
    !Number.isInteger(
      diaCorte,
    ) ||
    diaCorte < 1 ||
    diaCorte > 31
  ) {
    throw new Error(
      "El día de corte debe estar entre 1 y 31.",
    );
  }

  if (
    !Number.isInteger(
      diaPago,
    ) ||
    diaPago < 1 ||
    diaPago > 31
  ) {
    throw new Error(
      "El día de pago debe estar entre 1 y 31.",
    );
  }

  const limiteCredito =
    formulario
      .limiteCredito
      .trim()
      ? Number(
          formulario
            .limiteCredito,
        )
      : null;

  if (
    limiteCredito !== null &&
    (
      !Number.isFinite(
        limiteCredito,
      ) ||
      limiteCredito <= 0
    )
  ) {
    throw new Error(
      "El límite de crédito debe ser mayor que cero.",
    );
  }

  const pagoObjetivo =
    formulario
      .pagoObjetivo
      .trim()
      ? Number(
          formulario
            .pagoObjetivo,
        )
      : null;

  if (
    formulario
      .estrategiaPago ===
      "pago_objetivo" &&
    (
      pagoObjetivo === null ||
      !Number.isFinite(
        pagoObjetivo,
      ) ||
      pagoObjetivo <= 0
    )
  ) {
    throw new Error(
      "Escribe un pago objetivo mayor que cero.",
    );
  }

  return {
    nombre,
    ultimosCuatro,

    saldoInicial:
      Math.round(
        saldoInicial * 100,
      ) / 100,

    fechaSaldoInicial:
      formulario
        .fechaSaldoInicial,

    diaCorte,
    diaPago,

    activa:
      formulario.activa,

    estrategiaPago:
      formulario
        .estrategiaPago,

    pagoObjetivo:
      formulario
        .estrategiaPago ===
        "pago_objetivo"
        ? pagoObjetivo
        : null,

    limiteCredito:
      limiteCredito === null
        ? null
        : Math.round(
            limiteCredito *
              100,
          ) / 100,

    notas:
      formulario
        .notas
        .trim(),
  };
}

/**
 * TARJETAS - 3. Coordina la lista, creación,
 * edición y activación dentro de un solo modal.
 */
export function CreditCardsModal({
  abierto,
  tarjetas,
  cargando,
  guardando,
  actualizandoId,
  onCerrar,
  onCrear,
  onActualizar,
  onCambiarEstado,
}: CreditCardsModalProps) {
  const [
    vista,
    setVista,
  ] =
    useState<VistaModal>(
      "lista",
    );

  const [
    tarjetaEditada,
    setTarjetaEditada,
  ] =
    useState<TarjetaCredito | null>(
      null,
    );

  const [
    formulario,
    setFormulario,
  ] =
    useState<CreditCardFormValues>(
      crearFormularioInicial,
    );

  const [
    errorLocal,
    setErrorLocal,
  ] =
    useState<string | null>(
      null,
    );

  const procesando =
    guardando ||
    actualizandoId !== null;

  useEffect(() => {
    if (!abierto) {
      setVista("lista");
      setTarjetaEditada(
        null,
      );
      setFormulario(
        crearFormularioInicial(),
      );
      setErrorLocal(null);
    }
  }, [abierto]);

  if (!abierto) {
    return null;
  }

  const mostrarLista = () => {
    if (procesando) {
      return;
    }

    setVista("lista");
    setTarjetaEditada(
      null,
    );
    setFormulario(
      crearFormularioInicial(),
    );
    setErrorLocal(null);
  };

  const comenzarCreacion =
    () => {
      if (procesando) {
        return;
      }

      setTarjetaEditada(
        null,
      );
      setFormulario(
        crearFormularioInicial(),
      );
      setErrorLocal(null);
      setVista("crear");
    };

  const comenzarEdicion = (
    tarjeta: TarjetaCredito,
  ) => {
    if (procesando) {
      return;
    }

    setTarjetaEditada(
      tarjeta,
    );

    setFormulario(
      formularioDesdeTarjeta(
        tarjeta,
      ),
    );

    setErrorLocal(null);
    setVista("editar");
  };

  const alternarEstado =
    async (
      tarjeta:
        TarjetaCredito,
    ) => {
      if (procesando) {
        return;
      }

      setErrorLocal(null);

      await onCambiarEstado(
        tarjeta.id,
        !tarjeta.activa,
      );
    };

  const guardarFormulario =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();
      setErrorLocal(null);

      try {
        const datos =
          convertirFormulario(
            formulario,
          );

        const guardado =
          vista === "editar" &&
          tarjetaEditada
            ? await onActualizar(
                tarjetaEditada.id,
                datos,
              )
            : await onCrear(
                datos,
              );

        if (guardado) {
          // No usa mostrarLista() porque el estado
          // remoto puede seguir marcando "guardando"
          // durante este mismo ciclo de renderizado.
          setVista("lista");

          setTarjetaEditada(
            null,
          );

          setFormulario(
            crearFormularioInicial(),
          );

          setErrorLocal(null);
        }
      } catch (
        conversionError
      ) {
        setErrorLocal(
          conversionError instanceof
            Error
            ? conversionError.message
            : "Revisa la información de la tarjeta.",
        );
      }
    };

  const titulo =
    vista === "lista"
      ? "Administrar tarjetas"
      : vista === "crear"
        ? "Agregar tarjeta"
        : "Editar tarjeta";

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !procesando
        ) {
          onCerrar();
        }
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-cards-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-slate-50 shadow-2xl sm:max-w-4xl sm:rounded-3xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl bg-indigo-100 p-2.5 text-indigo-700">
              <CreditCard className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-500">
                Presupuesto Felo
              </p>

              <h2
                id="credit-cards-modal-title"
                className="truncate font-black text-slate-950"
              >
                {titulo}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={procesando}
            aria-label="Cerrar administrador de tarjetas"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          {vista === "lista" ? (
            <CreditCardsList
              tarjetas={tarjetas}
              cargando={cargando}
              procesando={
                procesando
              }
              actualizandoId={
                actualizandoId
              }
              onCrear={
                comenzarCreacion
              }
              onEditar={
                comenzarEdicion
              }
              onAlternarEstado={
                alternarEstado
              }
            />
          ) : (
            <CreditCardForm
              titulo={
                vista === "crear"
                  ? "Nueva tarjeta"
                  : tarjetaEditada
                    ?.nombre ??
                    "Editar tarjeta"
              }
              descripcion={
                vista === "crear"
                  ? "Registra el saldo actual, las fechas importantes y la estrategia de pago."
                  : "Actualiza la configuración financiera de esta tarjeta."
              }
              formulario={
                formulario
              }
              setFormulario={
                setFormulario
              }
              error={
                errorLocal
              }
              guardando={
                procesando
              }
              editando={
                vista === "editar"
              }
              onVolver={
                mostrarLista
              }
              onSubmit={
                guardarFormulario
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

export default CreditCardsModal;