import { Card } from "@/components/ui/card";
import { QrCode, FileText, Receipt, ArrowRightLeft, FileSpreadsheet, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickShortcutsProps {
  activeTab: string;
  onChange: (tab: string) => void;
  accentColor: string;
  items?: string[];
}

const ALL_ITEMS = [
  { id: "visao", label: "Visão Geral", icon: LayoutDashboard },
  { id: "pix", label: "PIX", icon: QrCode },
  { id: "boletos", label: "Boletos", icon: FileText },
  { id: "extrato", label: "Extrato", icon: Receipt },
  { id: "transferencia", label: "Transferência", icon: ArrowRightLeft },
  { id: "ofx", label: "OFX", icon: FileSpreadsheet },
];

export default function QuickShortcuts({ activeTab, onChange, accentColor, items }: QuickShortcutsProps) {
  const visible = items ? ALL_ITEMS.filter(i => items.includes(i.id)) : ALL_ITEMS;
  const cols = visible.length <= 2 ? "grid-cols-2" : visible.length <= 3 ? "grid-cols-3" : visible.length <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-6";
  return (
    <div className={cn("grid gap-2", cols)}>
      {visible.map(({ id, label, icon: Icon }) => {

        const active = activeTab === id;
        return (
          <Card
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md p-3 flex flex-col items-center justify-center gap-1.5 text-center select-none",
              active ? "ring-2 shadow-md" : "hover:-translate-y-0.5",
            )}
            style={active ? { borderColor: accentColor, boxShadow: `0 0 0 2px ${accentColor}33` } : undefined}
          >
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: `${accentColor}1a`, color: accentColor }}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            <span className="text-[11px] font-medium leading-tight">{label}</span>
          </Card>
        );
      })}
    </div>
  );
}
