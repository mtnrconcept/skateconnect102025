export type AttributeInput = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export const CATEGORY_ATTRIBUTES: Record<string, AttributeInput[]> = {
  boards: [
    { id: 'brand', label: 'Marque', type: 'text', placeholder: 'Ex: Polar, Baker' },
    { id: 'deck_width', label: 'Largeur (pouces)', type: 'number', placeholder: 'Ex: 8.25' },
  ],
  completes: [
    { id: 'brand', label: 'Marque', type: 'text' },
    { id: 'size', label: 'Taille', type: 'text', placeholder: 'Ex: M, L' },
  ],
  wheels: [
    { id: 'diameter', label: 'Diamètre (mm)', type: 'number', placeholder: 'Ex: 52' },
    { id: 'durometer', label: 'Dureté (A)', type: 'number', placeholder: 'Ex: 99' },
    { id: 'brand', label: 'Marque', type: 'text' },
  ],
  trucks: [
    { id: 'width', label: 'Largeur (mm)', type: 'number', placeholder: 'Ex: 139' },
    { id: 'brand', label: 'Marque', type: 'text' },
  ],
  bearings: [
    { id: 'brand', label: 'Marque', type: 'text' },
    { id: 'abec', label: 'ABEC', type: 'number', placeholder: 'Ex: 7' },
  ],
  clothing: [
    { id: 'brand', label: 'Marque', type: 'text' },
    { id: 'size', label: 'Taille', type: 'text', placeholder: 'Ex: M' },
  ],
  shoes: [
    { id: 'brand', label: 'Marque', type: 'text' },
    { id: 'size_eu', label: 'Pointure (EU)', type: 'number', placeholder: 'Ex: 42' },
  ],
  accessories: [
    { id: 'brand', label: 'Marque', type: 'text' },
  ],
  protection: [
    { id: 'brand', label: 'Marque', type: 'text' },
    { id: 'size', label: 'Taille', type: 'text' },
  ],
  other: [],
};

