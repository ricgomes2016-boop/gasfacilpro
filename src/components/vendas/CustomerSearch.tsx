// UPDATED VERSION WITH MOBILE FIXES
import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Search, UserPlus, User, Phone, MapPin, Loader2, Map } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone, formatCEP } from "@/hooks/useInputMasks";
import { geocodeAddress } from "@/lib/geocoding";
import { MapPickerDialog } from "@/components/ui/map-picker-dialog";
import type { GeocodingResult } from "@/lib/geocoding";
import { useUnidade } from "@/contexts/UnidadeContext";

// ... (código mantido igual até a parte do layout)

        {/* Search Row */}
        <div className="flex flex-col sm:flex-row gap-3 w-full min-w-0" ref={searchRef}>
          <div className="flex-1 relative min-w-0 overflow-hidden">
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="(00) 00000-0000"
                value={value.telefone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  handleFieldChange("telefone", formatted);
                  searchClientes(formatted, "telefone");
                }}
                className="pl-10 w-full min-w-0 truncate"
                maxLength={16}
              />
            </div>
          </div>
          <div className="flex-1 relative min-w-0 overflow-hidden">
            <Label className="text-xs text-muted-foreground">Nome do Cliente</Label>
            <div className="relative">
              <Input
                placeholder="Nome do cliente"
                value={value.nome}
                onChange={(e) => {
                  handleFieldChange("nome", e.target.value);
                  searchClientes(e.target.value, "nome");
                }}
                className="w-full min-w-0 truncate"
                title={value.nome}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

// resto do arquivo permanece igual
