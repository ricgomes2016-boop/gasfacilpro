import L from "leaflet";

// Custom delivery person icon
export const createEntregadorIcon = (isSelected: boolean = false, gpsOffline: boolean = false) => {
  const bg = gpsOffline
    ? 'hsl(var(--muted-foreground))'
    : isSelected
      ? 'hsl(var(--primary))'
      : 'hsl(var(--success))';
  const size = isSelected ? 48 : 40;
  const alertBadge = gpsOffline
    ? `<div style="
        position: absolute;
        top: -4px;
        right: -4px;
        background: hsl(var(--destructive));
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid hsl(var(--card));
        font-size: 11px;
        color: hsl(var(--destructive-foreground));
        font-weight: bold;
      ">!</div>`
    : '';

  return new L.DivIcon({
    className: "custom-entregador-icon",
    html: `
      <div style="
        position: relative;
        background: ${bg};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid hsl(var(--card));
        box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
        color: hsl(var(--primary-foreground));
        ${gpsOffline ? 'opacity: 0.7;' : ''}
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
        ${alertBadge}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
};

// Custom client/destination icon with status-based colors
export const createClienteIcon = (status: string = "pendente", isSelected: boolean = false) => {
  const colors: Record<string, string> = {
    pendente: "hsl(45, 93%, 47%)",    // yellow/warning
    confirmado: "hsl(142, 71%, 45%)", // green
    em_rota: "hsl(217, 91%, 60%)",    // blue
  };
  const bg = colors[status] || "hsl(var(--muted))";
  const size = isSelected ? 40 : 32;
  const border = isSelected ? "3px solid hsl(var(--primary))" : "2px solid hsl(var(--card))";

  return new L.DivIcon({
    className: "custom-cliente-icon",
    html: `
      <div style="
        background: ${bg};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: ${border};
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        transition: all 0.2s ease;
        color: hsl(var(--primary-foreground));
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
};

// Percurso icon (waypoint)
export const createPercursoIcon = (index: number) => new L.DivIcon({
  className: "custom-percurso-icon",
  html: `
    <div style="
      background: hsl(var(--muted-foreground));
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid hsl(var(--card));
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      font-size: 10px;
      font-weight: bold;
      color: hsl(var(--primary-foreground));
    ">
      ${index + 1}
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});
