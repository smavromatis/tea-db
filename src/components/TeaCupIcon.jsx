/**
 * TeaCupIcon — A custom Lucide-styled SVG teacup with a coloured droplet inside.
 * The cup outline perfectly matches the Lucide "Coffee" icon standard, 
 * integrating seamlessly with the rest of your app's icons.
 */
const TeaCupIcon = ({ size = 16, liquidColor = '#B07D46', cupColor = 'currentColor', className = '' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cupColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {/* The coloured droplet swatch sitting inside the mug */}
      <path
        d="M10 10.5 C10 10.5, 7 14.5, 7 16.5 C7 18.15, 8.35 19.5, 10 19.5 C11.65 19.5, 13 18.15, 13 16.5 C13 14.5, 10 10.5, 10 10.5 Z"
        fill={liquidColor}
        stroke="none"
      />
      
      {/* Mug Body */}
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      
      {/* Handle */}
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      
      {/* Steam Wisps */}
      <line x1="6" x2="6" y1="2" y2="4" opacity="0.6" />
      <line x1="10" x2="10" y1="2" y2="4" opacity="0.6" />
      <line x1="14" x2="14" y1="2" y2="4" opacity="0.6" />
    </svg>
  );
};

export default TeaCupIcon;
