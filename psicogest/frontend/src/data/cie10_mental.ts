export interface Cie10Entry {
  code: string;
  description: string;
}

export const CIE10_MENTAL: Cie10Entry[] = [
  { code: "F200", description: "Esquizofrenia paranoide" },
  { code: "F209", description: "Esquizofrenia no especificada" },
  { code: "F310", description: "Trastorno bipolar, episodio actual hipomaniaco" },
  { code: "F311", description: "Trastorno bipolar, episodio actual maníaco sin síntomas psicóticos" },
  { code: "F312", description: "Trastorno bipolar, episodio actual maníaco con síntomas psicóticos" },
  { code: "F313", description: "Trastorno bipolar, episodio actual depresivo leve o moderado" },
  { code: "F314", description: "Trastorno bipolar, episodio actual depresivo grave sin síntomas psicóticos" },
  { code: "F319", description: "Trastorno afectivo bipolar no especificado" },
  { code: "F320", description: "Episodio depresivo leve" },
  { code: "F321", description: "Episodio depresivo moderado" },
  { code: "F322", description: "Episodio depresivo grave sin síntomas psicóticos" },
  { code: "F323", description: "Episodio depresivo grave con síntomas psicóticos" },
  { code: "F329", description: "Episodio depresivo no especificado" },
  { code: "F330", description: "Trastorno depresivo recurrente, episodio actual leve" },
  { code: "F331", description: "Trastorno depresivo recurrente, episodio actual moderado" },
  { code: "F332", description: "Trastorno depresivo recurrente, episodio actual grave sin síntomas psicóticos" },
  { code: "F339", description: "Trastorno depresivo recurrente, no especificado" },
  { code: "F400", description: "Agorafobia" },
  { code: "F401", description: "Fobias sociales" },
  { code: "F409", description: "Trastorno fóbico de ansiedad no especificado" },
  { code: "F410", description: "Trastorno de pánico" },
  { code: "F411", description: "Trastorno de ansiedad generalizada" },
  { code: "F412", description: "Trastorno mixto ansioso-depresivo" },
  { code: "F419", description: "Trastorno de ansiedad no especificado" },
  { code: "F420", description: "TOC - predominio de pensamientos obsesivos" },
  { code: "F421", description: "TOC - predominio de actos compulsivos" },
  { code: "F429", description: "Trastorno obsesivo-compulsivo no especificado" },
  { code: "F430", description: "Reacción aguda al estrés" },
  { code: "F431", description: "Trastorno de estrés postraumático (TEPT)" },
  { code: "F432", description: "Trastorno de adaptación" },
  { code: "F439", description: "Reacción al estrés grave no especificada" },
  { code: "F440", description: "Amnesia disociativa" },
  { code: "F441", description: "Fuga disociativa" },
  { code: "F449", description: "Trastorno disociativo no especificado" },
  { code: "F450", description: "Trastorno de somatización" },
  { code: "F451", description: "Trastorno somatomorfo indiferenciado" },
  { code: "F452", description: "Trastorno hipocondriaco" },
  { code: "F459", description: "Trastorno somatomorfo no especificado" },
  { code: "F480", description: "Neurastenia" },
  { code: "F500", description: "Anorexia nerviosa" },
  { code: "F502", description: "Bulimia nerviosa" },
  { code: "F509", description: "Trastorno de la conducta alimentaria no especificado" },
  { code: "F600", description: "Trastorno paranoide de la personalidad" },
  { code: "F601", description: "Trastorno esquizoide de la personalidad" },
  { code: "F602", description: "Trastorno disocial de la personalidad" },
  { code: "F603", description: "Trastorno de inestabilidad emocional de la personalidad" },
  { code: "F604", description: "Trastorno histriónico de la personalidad" },
  { code: "F605", description: "Trastorno anancástico de la personalidad" },
  { code: "F606", description: "Trastorno ansioso (evasivo) de la personalidad" },
  { code: "F607", description: "Trastorno dependiente de la personalidad" },
  { code: "F609", description: "Trastorno de la personalidad no especificado" },
  { code: "F700", description: "Retraso mental leve" },
  { code: "F709", description: "Retraso mental leve, sin mención de deterioro del comportamiento" },
  { code: "F800", description: "Trastorno específico de la pronunciación" },
  { code: "F840", description: "Autismo en la niñez" },
  { code: "F845", description: "Síndrome de Asperger" },
  { code: "F900", description: "Perturbación de la actividad y la atención (TDAH)" },
  { code: "F901", description: "Trastorno hipercinetico de la conducta" },
  { code: "F909", description: "Trastorno hipercinetico no especificado" },
  { code: "F910", description: "Trastorno de la conducta limitado al contexto familiar" },
  { code: "F919", description: "Trastorno de la conducta no especificado" },
  { code: "F920", description: "Trastorno depresivo de la conducta" },
  { code: "F930", description: "Trastorno de ansiedad de separación en la niñez" },
  { code: "F940", description: "Mutismo selectivo" },
  { code: "F980", description: "Enuresis no orgánica" },
  { code: "F989", description: "Trastorno del comportamiento y de las emociones de la infancia no especificado" },
  { code: "F999", description: "Trastorno mental no especificado" },
];

export function searchCie10(query: string): Cie10Entry[] {
  const q = query.toLowerCase();
  return CIE10_MENTAL.filter(
    (e) =>
      e.code.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
  );
}
