/**
 * Zusatzansichten des interaktiven Fahrzeugmodells (Draufsicht, viewBox 400 × 720; Front oben, Heck unten).
 * ALLE Angaben sind typische, schematische Lagen – keine modellgenaue Dokumentation und keine Schadenbehauptung.
 * OFFEN: fachliche Freigabe durch ING / Ekrem (siehe docs/EKREM-ANFORDERUNGEN-ABGLEICH.md).
 */
export type LayerKey = 'zones' | 'sensors' | 'battery' | 'structure';

export const LAYERS: { key: LayerKey; label: string; hint: string }[] = [
  { key: 'zones', label: 'Schadenzonen', hint: 'Sechs Prüfbereiche am Fahrzeug' },
  { key: 'sensors', label: 'Assistenzsysteme', hint: 'Typische Sensorpositionen' },
  { key: 'battery', label: 'Hochvolt-Batterie', hint: 'Elektro- und Plug-in-Hybridfahrzeuge' },
  { key: 'structure', label: 'Struktur Heck', hint: 'Heck- und Kofferraumbereich' },
];

export type Marker = { x: number; y: number };
export type LayerItem = {
  key: string;
  index: string;
  title: string;
  text: string;
  points: string[];
  markers: Marker[];
  kind?: 'radar' | 'camera' | 'ultrasonic';
};

export const SENSOR_ITEMS: LayerItem[] = [
  {
    key: 'cam-front', index: 'SENSOR 01', title: 'Frontkamera', kind: 'camera', markers: [{ x: 200, y: 176 }],
    text: 'Sitzt typischerweise hinter der Windschutzscheibe im Bereich des Innenspiegels und erfasst Fahrspur, Fahrzeuge und Verkehrszeichen.',
    points: ['Nach Scheibentausch oder Unfall ist je nach Hersteller eine Kalibrierung vorgesehen', 'Kosten und Aufwand der Kalibrierung werden im Gutachten gesondert angesetzt'],
  },
  {
    key: 'radar-front', index: 'SENSOR 02', title: 'Front-Radar', kind: 'radar', markers: [{ x: 200, y: 46 }],
    text: 'Befindet sich typischerweise hinter Kühlergrill oder Stoßfängerverkleidung und misst Abstand und Relativgeschwindigkeit nach vorn.',
    points: ['Lage und Ausrichtung können nach Stoßfängerschäden von der Vorgabe abweichen', 'Prüfung und Einstellung erfolgen nach Herstellervorgabe'],
  },
  {
    key: 'us-front', index: 'SENSOR 03', title: 'Ultraschall vorn', kind: 'ultrasonic', markers: [{ x: 112, y: 80 }, { x: 150, y: 54 }, { x: 250, y: 54 }, { x: 288, y: 80 }],
    text: 'Parksensoren sitzen in der Stoßfängerverkleidung. Anzahl und Anordnung unterscheiden sich je nach Fahrzeug.',
    points: ['Lackierung und Halterung der Sensoren beeinflussen die Funktion', 'Beschädigte Sensoren oder Halter werden einzeln aufgenommen'],
  },
  {
    key: 'cam-side', index: 'SENSOR 04', title: 'Seiten- und Rundumkameras', kind: 'camera', markers: [{ x: 58, y: 222 }, { x: 342, y: 222 }],
    text: 'Nur bei Fahrzeugen mit Rundumsicht: Kameras in den Außenspiegeln ergänzen Front- und Heckkamera.',
    points: ['Ausstattungsabhängig – nicht jedes Fahrzeug besitzt diese Kameras', 'Spiegelschäden betreffen dann auch die Kamera'],
  },
  {
    key: 'cam-rear', index: 'SENSOR 05', title: 'Rückfahrkamera', kind: 'camera', markers: [{ x: 200, y: 606 }],
    text: 'Sitzt typischerweise an der Heckklappe oder am Griffbereich und unterstützt beim Rückwärtsfahren.',
    points: ['Betroffen bei Heckschäden und Heckklappentausch', 'Einstellung und Funktion werden nach der Reparatur geprüft'],
  },
  {
    key: 'radar-rear', index: 'SENSOR 06', title: 'Heck-Eckradar', kind: 'radar', markers: [{ x: 90, y: 622 }, { x: 310, y: 622 }],
    text: 'Radarsensoren in den hinteren Ecken der Stoßfängerverkleidung überwachen den toten Winkel und den Querverkehr.',
    points: ['Ausstattungsabhängig (Totwinkel- bzw. Querverkehrswarner)', 'Nach Heckschäden ist die Ausrichtung zu prüfen'],
  },
  {
    key: 'us-rear', index: 'SENSOR 07', title: 'Ultraschall hinten', kind: 'ultrasonic', markers: [{ x: 118, y: 668 }, { x: 158, y: 684 }, { x: 242, y: 684 }, { x: 282, y: 668 }],
    text: 'Parksensoren in der hinteren Stoßfängerverkleidung. Anzahl und Anordnung je nach Fahrzeug unterschiedlich.',
    points: ['Halter und Verkabelung werden bei Heckschäden mit erfasst', 'Lackierung kann die Messung beeinflussen'],
  },
];

export const BATTERY_ITEMS: LayerItem[] = [
  {
    key: 'pack', index: 'HOCHVOLT 01', title: 'Batteriegehäuse im Fahrzeugboden', markers: [{ x: 200, y: 362 }],
    text: 'Bei Elektrofahrzeugen sitzt die Hochvoltbatterie typischerweise flach im Unterboden zwischen den Achsen. Bauform und Größe sind modellabhängig.',
    points: ['Das Batteriegehäuse wird bei Unterbodenkontakt oder Seitenschäden gesondert betrachtet', 'Umfang der Prüfung richtet sich nach den Vorgaben des Herstellers'],
  },
  {
    key: 'lines', index: 'HOCHVOLT 02', title: 'Hochvolt-Leitungen (schematisch)', markers: [{ x: 200, y: 190 }],
    text: 'Von der Batterie führen Hochvolt-Leitungen zu Antrieb und Leistungselektronik. Der Verlauf ist hier nur sinnbildlich dargestellt.',
    points: ['Hochvolt-Komponenten werden im Gutachten gesondert bewertet', 'Arbeiten daran sind nur durch dafür qualifiziertes Personal zulässig'],
  },
];

export const STRUCTURE_ITEMS: LayerItem[] = [
  {
    key: 'rails', index: 'HECK 01', title: 'Hintere Längsträger', markers: [{ x: 152, y: 574 }, { x: 248, y: 574 }],
    text: 'Die hinteren Längsträger leiten Kräfte bei einem Heckaufprall in die Karosserie. Ihre Lage ist hier typisch, nicht modellgenau, dargestellt.',
    points: ['Vermessung gegen Herstellersollwerte', 'Beurteilung, ob eine Instandsetzung oder ein Bauteiltausch vorgesehen ist'],
  },
  {
    key: 'floor', index: 'HECK 02', title: 'Kofferraum- bzw. Ladeboden', markers: [{ x: 200, y: 566 }],
    text: 'Der Ladeboden ist Teil der Heckstruktur. Auch bei äußerlich geringem Schadenbild kann eine Prüfung der Verformung sinnvoll sein.',
    points: ['Sichtprüfung auf Verformung, Falten und Spaltmaße', 'Dokumentation mit Fotos und Messwerten'],
  },
  {
    key: 'panel', index: 'HECK 03', title: 'Heckabschlussblech und Querträger', markers: [{ x: 200, y: 670 }],
    text: 'Heckabschlussblech und Stoßfängerquerträger schließen die Struktur nach hinten ab und tragen die Verkleidung samt Sensorik.',
    points: ['Befestigungspunkte und Anbauteile werden mit erfasst', 'Betroffene Sensorik am Heck wird einzeln aufgeführt'],
  },
];
