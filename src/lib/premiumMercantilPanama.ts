// Contenido fijo de la cotización "premium" de Mercantil Panamá (plan Salud GB Integral).
// Transcrito de la cotización de referencia: revisar contra el folleto vigente de la aseguradora
// antes de enviarlo a clientes. Para cambiar un texto basta editar este archivo.

export const PORTADA = {
  kicker: "COTIZACIÓN · SALUD INTERNACIONAL",
  titulo: "Salud GB Integral",
  descripcion:
    "Póliza de salud internacional para residentes en América Latina y El Caribe (excepto Brasil y Canadá), y venezolanos y panameños residenciados en Alemania, España, Italia y Portugal.",
  saludo:
    "Estimado, reciba nuestros cordiales saludos. En atención a su solicitud nos complace informarle los términos de nuestro producto.",
};

export const PRINCIPALES = [
  { etiqueta: "MATERNIDAD · EXTERIOR", valor: "US$ 10.000", nota: "Titular o Cónyuge" },
  { etiqueta: "MATERNIDAD · EN VENEZUELA", valor: "US$ 25.000", nota: "Sin deducible" },
];

export const NOTA_PRIMAS =
  "Estos montos de primas son REFERENCIALES; los montos finales serán los que genere nuestro sistema al emitir el recibo y, por tanto, no obligan a Mercantil Panamá a la emisión de una póliza ni aceptación de riesgos.";

export const DETALLE_INTRO = [
  "Servicio y Cobertura Mundial (Requiere Precertificación).",
  "Se aplica un (01) deducible por asegurado con un máximo de dos (02) por certificado por año-póliza.",
  "En caso de accidente grave no se aplica deducible durante la primera hospitalización.",
  "Nuestra Póliza cubre el 100% de los gastos médicos usuales y razonables para las atenciones médicas.",
];
export const DETALLE_NOTA =
  "* Las atenciones médicas prestadas en Venezuela, incluyendo Maternidad, no serán objeto de aplicación de deducible.";

export const DETALLE: { titulo: string; lineas: string[] }[] = [
  {
    titulo: "Medicamentos por Prescripción Médica fuera de hospitalización",
    lineas: [
      "En Venezuela: Sin deducible / límite: Hasta la Suma Asegurada Contratada por año póliza.",
      "Fuera de Venezuela: 100% una vez agotado el deducible / límite: Hasta la Suma Asegurada Contratada por año póliza.",
    ],
  },
  {
    titulo: "Trasplantes de Órganos y Tejidos",
    lineas: [
      "US$ 500.000 por órgano(s) o tejidos por asegurado de por vida.",
      "Adicionalmente se pueden cubrir hasta US$ 40.000 los gastos correspondientes al Donante Vivo.",
    ],
  },
  {
    titulo: "Cobertura Dental por Accidente",
    lineas: [
      "US$ 50.000 por accidente, siempre que el tratamiento sea provisto dentro de los 90 días siguientes a la ocurrencia del accidente.",
    ],
  },
  {
    titulo: "VIH / SIDA",
    lineas: ["US$ 500.000 por Asegurado de por vida.", "Período de Espera de 24 meses."],
  },
  {
    titulo: "Transporte de Emergencia: Ambulancia Aérea",
    lineas: [
      "US$ 100.000 por Asegurado por Año Póliza al Hospital más cercano de tratamiento apropiado. No aplica deducible.",
    ],
  },
  {
    titulo: "Tratamientos Especiales (psiquiatría, autismo, Alzheimer) y Trastornos del sueño",
    lineas: ["US$ 5.000 por Asegurado por Año Póliza."],
  },
  {
    titulo: "Repatriación de Restos Mortales",
    lineas: [
      "US$ 25.000 por Asegurado en caso de fallecimiento como resultado de un Accidente o Enfermedad cubierta. No aplica deducible.",
    ],
  },
  {
    titulo: "Cuidados Paliativos / Hospicio",
    lineas: ["US$ 15.000 por un máximo de 30 días por asegurado de por vida."],
  },
  {
    titulo: "Maternidad",
    lineas: [
      "US$ 10.000 por parto (excepto en Venezuela: US$ 25.000, sin deducible).",
      "Cesárea Electiva: Incluida dentro del beneficio de acuerdo a la cobertura que aplique.",
      "Período de Espera de 10 meses.",
      "Costo por extracción y preservación por un (1) año de células madres incluido dentro del beneficio de Maternidad.",
      "Fuera de Venezuela: Si el deducible de la póliza es menor o igual que USD 5.000, para Maternidad no se aplica el mismo; en caso contrario el mismo se aplicará a la cobertura de Maternidad.",
    ],
  },
  {
    titulo: "Complicaciones de Maternidad y Complicaciones del Nacimiento",
    lineas: ["Hasta US$ 1.000.000 de por vida (para la madre).", "Período de Espera de 10 meses."],
  },
  {
    titulo: "Inclusión del Recién Nacido",
    lineas: [
      "Automática, sin evaluación de riesgo si nace de una maternidad cubierta por la póliza y es inscrito en ella dentro de los 60 días siguientes a la fecha de su nacimiento.",
    ],
  },
  {
    titulo: "Chequeo de rutina de menores de edad",
    lineas: [
      "De 0 a 12 meses: 3 visitas hasta US$ 200 cada una dentro de los primeros 12 meses de vida, sin deducible.",
      "A partir de los 12 meses y antes de los 18 años: un (1) chequeo anual hasta US$ 100 sin deducible.",
    ],
  },
  {
    titulo: "Examen Médico de Rutina para mayores de edad (18+)",
    lineas: ["Hasta US$ 400 por asegurado y por Año Póliza. No aplica deducible."],
  },
  {
    titulo: "Control anual de Ginecología y Urología",
    lineas: [
      "Mujeres (no aplica a hijas dependientes) — Copago del 50%:",
      "Mamografía anual a partir de los 40 años.",
      "Cita de control anual y Papanicolaou.",
      "Hombres — Copago del 50%:",
      "Antígeno Prostático Anual a partir de los 40 años.",
      "Cita de control anual.",
      "En ambos casos se cubre una (01) por año póliza con límite anual de US$ 150.",
    ],
  },
  {
    titulo: "Condiciones congénitas y/o hereditarias",
    lineas: [
      "Diagnosticada antes de los 18 años: US$ 1.000.000 por asegurado de por vida.",
      "Diagnosticada a partir de los 18 años: hasta la Suma Asegurada contratada por asegurado de por vida.",
    ],
  },
];

export const EXTRAS = [
  "En caso de fallecimiento del Asegurado Titular por accidente o enfermedad cubierto, sus dependientes podrán mantener la póliza en vigor sin pagar primas durante los 3 años subsiguientes.",
  "Seguro de Vida: US$ 10.000 por cualquier causa / US$ 10.000 adicionales si el fallecimiento es por accidente.",
  "Hasta US$ 5.000 por Desmembramiento a causa de accidente.",
  "Renta Mensual por Incapacidad: US$ 1.000 hasta un máximo de 6 meses o al término de la incapacidad, lo que ocurra primero.",
  "Servicio Funerario US$ 2.000 por Asegurado.",
  "Servicio de atención primaria — Plan de Atención Médica Mercantil (PAMM) en Venezuela.",
  "Opción de Reembolsos en USD por ZINLI o Mercantil Banco Panamá.",
  "Emisión de póliza digital desde www.mercantilseguros.com.pa",
];

export const SERVICIO_SALUD = [
  "Orientación médica telefónica",
  "Consulta por videollamada",
  "Traslados de emergencia",
  "Entrega de medicamentos para enfermedades agudas (hasta 14 días de tratamiento)",
  "Atención médica domiciliaria",
  "Laboratorio y rayos X a domicilio",
];

export const VIAJES = {
  texto:
    "Nuestro servicio se extiende a todo el mundo fuera del país de residencia habitual del cliente durante los primeros 60 días desde el inicio del viaje. No aplica deducible y se obtiene con sólo una llamada al Centro de Atención Telefónica Mercantil dentro de las 24 primeras horas de ocurrido el evento.",
  whatsapp: "+507 6383 0380",
  tarjetas: [
    { etiqueta: "VIAJES A EUROPA", valor: "EUR € 40.000", nota: "por lesión o enfermedad durante el viaje" },
    { etiqueta: "RESTO DEL MUNDO", valor: "US$ 50.000", nota: "por lesión o enfermedad durante el viaje" },
    { etiqueta: "PREEXISTENCIAS", valor: "US$ 15.000", nota: "Personas hasta 74 años (según anexo)" },
  ],
};

export const PORTABILIDAD = {
  intro:
    "Esta póliza es Portable. Después de permanecer al menos 6 meses en el país de domicilio indicado en la solicitud de seguros, podrá fijar su residencia en cualquiera de los siguientes países sin que la tarifa se modifique por ese motivo:",
  paises: ["Países de América (excepto Brasil y Canadá)", "Venezolanos y panameños en Alemania, España, Italia y Portugal"],
  eeuu: "En el caso de quienes vayan a residir en los Estados Unidos, la póliza es válida mientras no tengan ciudadanía estadounidense.",
};

export const AVISO_LEGAL = [
  "Esta cotización tiene una validez de quince (15) días continuos a partir de la presente fecha. Los riesgos, condiciones y coberturas cotizadas son los mencionados en este documento; aquellas coberturas o condiciones no reflejadas se consideran no cotizadas. Los montos definitivos serán los que genere nuestro sistema al emitir el recibo.",
  "Esta propuesta no obliga a Mercantil Seguros y Reaseguros a la emisión de la póliza ni a la aceptación de riesgos, ya que la emisión estará sujeta a las políticas de suscripción de la empresa, a la evaluación del riesgo y de la solicitud de seguros, que debe estar totalmente completada (llenada y firmada por el Solicitante).",
];

export const PIE = [
  "Mercantil Seguros y Reaseguros, S. A. — RUC: 2492633-1-817803 DV 36",
  "Regulada y supervisada por la Superintendencia de Seguros y Reaseguros de Panamá.",
  "Calle Punta Darién, Torres de las Américas, Torre A, Piso 14, Urbanización Punta Pacífica, Ciudad de Panamá.",
  "Tel +(507) 304-1150 · Fax +(507) 302-8908 · www.mercantilseguros.com.pa",
];

/** ¿Este plan cotizado usa la plantilla premium? */
export const esMercantilPanama = (aseguradora: string) => /mercantil\s*pan/i.test(aseguradora);
