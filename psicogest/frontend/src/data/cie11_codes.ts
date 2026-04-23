export interface Cie11Entry {
  code: string;
  description: string;
}

export const CIE11_CODES: Cie11Entry[] = [
  // Trastornos del neurodesarrollo
  { code: "6A00", description: "Discapacidad intelectual leve" },
  { code: "6A01", description: "Discapacidad intelectual moderada" },
  { code: "6A02", description: "Trastorno del espectro autista" },
  { code: "6A03", description: "Trastorno del aprendizaje del desarrollo" },
  { code: "6A04", description: "Trastorno del desarrollo de la coordinación motora" },
  { code: "6A05", description: "Trastorno por déficit de atención con hiperactividad (TDAH)" },
  { code: "6A06", description: "Trastorno del habla y el lenguaje del desarrollo" },
  // Esquizofrenia y trastornos psicóticos
  { code: "6A20", description: "Esquizofrenia" },
  { code: "6A21", description: "Trastorno esquizoafectivo" },
  { code: "6A22", description: "Trastorno esquizotípico" },
  { code: "6A23", description: "Trastorno psicótico agudo y transitorio" },
  { code: "6A24", description: "Trastorno delirante" },
  // Trastornos bipolares
  { code: "6A40", description: "Trastorno bipolar tipo I" },
  { code: "6A41", description: "Trastorno bipolar tipo II" },
  { code: "6A42", description: "Trastorno ciclotímico" },
  // Trastornos depresivos
  { code: "6A60", description: "Trastorno depresivo de episodio único" },
  { code: "6A60.0", description: "Trastorno depresivo de episodio único, leve" },
  { code: "6A60.1", description: "Trastorno depresivo de episodio único, moderado sin síntomas psicóticos" },
  { code: "6A60.2", description: "Trastorno depresivo de episodio único, moderado con síntomas psicóticos" },
  { code: "6A60.3", description: "Trastorno depresivo de episodio único, grave sin síntomas psicóticos" },
  { code: "6A61", description: "Trastorno depresivo recurrente" },
  { code: "6A62", description: "Trastorno distímico" },
  { code: "6A63", description: "Trastorno mixto depresivo y de ansiedad" },
  // Trastornos de ansiedad
  { code: "6A70", description: "Trastorno de ansiedad generalizada" },
  { code: "6A71", description: "Trastorno de pánico" },
  { code: "6A72", description: "Agorafobia" },
  { code: "6A73", description: "Fobia específica" },
  { code: "6A74", description: "Trastorno de ansiedad social (fobia social)" },
  { code: "6A75", description: "Trastorno de ansiedad por separación" },
  { code: "6A76", description: "Mutismo selectivo" },
  // Trastornos obsesivo-compulsivos y relacionados
  { code: "6A80", description: "Trastorno obsesivo-compulsivo (TOC)" },
  { code: "6A81", description: "Trastorno dismórfico corporal" },
  { code: "6A82", description: "Trastorno de referencia olfativa" },
  { code: "6A83", description: "Hipocondría / Trastorno de ansiedad por enfermedad" },
  { code: "6A84", description: "Trastorno de acumulación (hoarding)" },
  { code: "6A85", description: "Trastornos de comportamientos repetitivos focalizados en el cuerpo" },
  // Trastornos relacionados con el trauma
  { code: "6B00", description: "Trastorno de estrés postraumático (TEPT)" },
  { code: "6B01", description: "Trastorno de estrés postraumático complejo" },
  { code: "6B02", description: "Trastorno de duelo prolongado" },
  { code: "6B03", description: "Trastorno de adaptación" },
  { code: "6B04", description: "Trastorno de apego reactivo" },
  { code: "6B05", description: "Trastorno de vinculación social desinhibida" },
  // Trastornos disociativos
  { code: "6B20", description: "Trastorno de síntoma neurológico disociativo (conversivo)" },
  { code: "6B21", description: "Amnesia disociativa" },
  { code: "6B22", description: "Trastorno de trance" },
  { code: "6B24", description: "Trastorno de identidad disociativo" },
  { code: "6B25", description: "Trastorno de identidad disociativo parcial" },
  // Trastornos de malestar corporal
  { code: "6B40", description: "Trastorno de malestar corporal" },
  { code: "6B41", description: "Dismorfia de integridad corporal" },
  // Trastornos alimentarios
  { code: "6C00", description: "Anorexia nerviosa" },
  { code: "6C01", description: "Bulimia nerviosa" },
  { code: "6C02", description: "Trastorno por atracón" },
  { code: "6C03", description: "Trastorno de ingesta evitativa/restrictiva" },
  { code: "6C04", description: "Pica" },
  { code: "6C05", description: "Trastorno de rumiación-regurgitación" },
  // Control de impulsos
  { code: "6C10", description: "Trastorno explosivo intermitente" },
  { code: "6C11", description: "Piromanía" },
  { code: "6C12", description: "Cleptomanía" },
  // Conducta disocial
  { code: "6C20", description: "Trastorno negativista desafiante" },
  { code: "6C21", description: "Trastorno de conducta disocial" },
  // Trastornos por uso de sustancias
  { code: "6C40", description: "Uso nocivo de alcohol" },
  { code: "6C40.1", description: "Dependencia al alcohol" },
  { code: "6C41", description: "Uso nocivo de cannabis" },
  { code: "6C41.1", description: "Dependencia al cannabis" },
  { code: "6C42", description: "Uso nocivo de sintéticos de cannabis" },
  { code: "6C43", description: "Uso nocivo de opioides" },
  { code: "6C43.1", description: "Dependencia a opioides" },
  { code: "6C44", description: "Uso nocivo de sedantes, hipnóticos o ansiolíticos" },
  { code: "6C44.1", description: "Dependencia a sedantes, hipnóticos o ansiolíticos" },
  { code: "6C45", description: "Uso nocivo de cocaína" },
  { code: "6C45.1", description: "Dependencia a cocaína" },
  { code: "6C46", description: "Uso nocivo de estimulantes (anfetaminas, etc.)" },
  { code: "6C4A", description: "Uso nocivo de nicotina" },
  { code: "6C4B", description: "Uso nocivo de cafeína" },
  // Trastornos del juego y comportamiento
  { code: "6C50", description: "Trastorno por juego" },
  { code: "6C51", description: "Trastorno por videojuegos" },
  // Trastornos de la personalidad
  { code: "6D10", description: "Trastorno de la personalidad leve" },
  { code: "6D11", description: "Trastorno de la personalidad moderado" },
  { code: "6D12", description: "Trastorno de la personalidad grave" },
  // Especificadores de patrón de personalidad
  { code: "6D10.0", description: "Trastorno de la personalidad — patrón negativo/afectivo" },
  { code: "6D10.1", description: "Trastorno de la personalidad — patrón desapegado" },
  { code: "6D10.2", description: "Trastorno de la personalidad — patrón disocial" },
  { code: "6D10.3", description: "Trastorno de la personalidad — patrón desinhibido" },
  { code: "6D10.4", description: "Trastorno de la personalidad — patrón anancástico (obsesivo-compulsivo)" },
  { code: "6D10.5", description: "Trastorno límite de la personalidad" },
  // Trastornos parafílicos
  { code: "6D30", description: "Trastorno parafílico exhibicionista" },
  { code: "6D31", description: "Trastorno parafílico voyeurista" },
  { code: "6D32", description: "Trastorno parafílico pedofílico" },
  // Disforia de género
  { code: "HA60", description: "Incongruencia de género en la adolescencia o la edad adulta" },
  { code: "HA61", description: "Incongruencia de género en la infancia" },
  // Trastornos del sueño (selección)
  { code: "7A00", description: "Insomnio crónico" },
  { code: "7A01", description: "Insomnio a corto plazo" },
  { code: "7B01", description: "Trastorno de hipersomnia idiopática" },
  { code: "7B20", description: "Trastorno del ritmo circadiano sueño-vigilia" },
  { code: "7C10", description: "Trastorno de pesadillas" },
  { code: "7C11", description: "Trastorno de conductas del sueño REM" },
  { code: "7C12", description: "Sonambulismo" },
];

export function searchCie11(query: string): Cie11Entry[] {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  return CIE11_CODES.filter(
    (e) =>
      e.code.toLowerCase().startsWith(q) ||
      e.description.toLowerCase().includes(q)
  ).slice(0, 10);
}
