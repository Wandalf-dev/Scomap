export interface SidebarVariant {
  name: string;
  value: string;
  description: string;
}

export interface SidebarCollapsibleOption {
  name: string;
  value: string;
  description: string;
}

export interface SidebarSideOption {
  name: string;
  value: string;
}

export interface RadiusOption {
  name: string;
  value: string;
}

export const radiusOptions: RadiusOption[] = [
  { name: "0", value: "0rem" },
  { name: "0.3", value: "0.3rem" },
  { name: "0.5", value: "0.5rem" },
  { name: "0.75", value: "0.75rem" },
  { name: "1.0", value: "1rem" },
];

export const sidebarVariants: SidebarVariant[] = [
  {
    name: "Default",
    value: "sidebar",
    description: "Standard sidebar layout",
  },
  {
    name: "Floating",
    value: "floating",
    description: "Floating sidebar with border",
  },
  {
    name: "Inset",
    value: "inset",
    description: "Inset sidebar with rounded corners",
  },
];

export const sidebarCollapsibleOptions: SidebarCollapsibleOption[] = [
  { name: "Off Canvas", value: "offcanvas", description: "Slides out of view" },
  { name: "Icon", value: "icon", description: "Collapses to icon only" },
  { name: "None", value: "none", description: "Always visible" },
];

export const sidebarSideOptions: SidebarSideOption[] = [
  { name: "Left", value: "left" },
  { name: "Right", value: "right" },
];
