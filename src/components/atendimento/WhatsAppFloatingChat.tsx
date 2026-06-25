import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppNotifications } from "@/contexts/WhatsAppNotificationContext";
import { WhatsAppInbox } from "./WhatsAppInbox";
import { cn } from "@/lib/utils";

const HIDDEN_PREFIXES = [
  "/auth",
  "/cliente",
  "/entregador",
  "/contador",
  "/transportadora",
  "/parceiro",
  "/centralgascp",
  "/fortegas",
  "/japagas",
];

export function WhatsAppFloatingChat() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { totalUnread, setWidgetOpen } = useWhatsAppNotifications();

  useEffect(() => { setWidgetOpen(open); }, [open, setWidgetOpen]);

  const path = location.pathname;
  const hidden = HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  if (hidden) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className={cn(
          "fixed bottom-4 right-4 z-50 hidden h-12 w-12 rounded-full shadow-lg md:inline-flex",
          "bg-green-600 hover:bg-green-700 text-white",
          open && "hidden"
        )}
        aria-label="Abrir Chat WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
        {totalUnread > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center rounded-full"
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="p-0 w-full sm:max-w-[720px] flex flex-col gap-0"
        >
          <SheetHeader className="px-4 py-3 border-b border-border/60 flex-row items-center justify-between space-y-0">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-green-600" />
              Chat WhatsApp
              {totalUnread > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5">
                  {totalUnread} nova{totalUnread > 1 ? "s" : ""}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <WhatsAppInbox className="h-full border-0 rounded-none" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
