import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Order } from "@/types";
import * as api from "@/services/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StarInput } from "@/components/common/Stars";

export function RatingDialog({ order, authorId, open, onOpenChange }: { order: Order; authorId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [rs, setRs] = useState(5);
  const [rc, setRc] = useState("");
  const [ds, setDs] = useState(5);
  const [dc, setDc] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      await api.createReview({ orderId: order.id, authorId, targetType: "RESTAURANT", targetId: order.restaurantId, stars: rs as 1, comment: rc.trim() || undefined });
      if (order.driverId) await api.createReview({ orderId: order.id, authorId, targetType: "DRIVER", targetId: order.driverId, stars: ds as 1, comment: dc.trim() || undefined });
    },
    onSuccess: () => {
      toast.success("شكراً لتقييمك!");
      qc.invalidateQueries({ queryKey: ["reviews"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="rounded-3xl">
        <DialogHeader className="text-right"><DialogTitle>قيّم طلبك {order.code}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="font-bold">المطعم</p>
            <StarInput value={rs} onChange={setRs} label="تقييم المطعم" />
            <Label htmlFor="rc" className="sr-only">تعليق على المطعم</Label>
            <Textarea id="rc" value={rc} onChange={(e) => setRc(e.target.value)} placeholder="رأيك بالأكل (اختياري)" />
          </div>
          {order.driverId && (
            <div className="space-y-2">
              <p className="font-bold">السائق</p>
              <StarInput value={ds} onChange={setDs} label="تقييم السائق" />
              <Label htmlFor="dc" className="sr-only">تعليق على السائق</Label>
              <Textarea id="dc" value={dc} onChange={(e) => setDc(e.target.value)} placeholder="رأيك بالتوصيل (اختياري)" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={() => m.mutate()} disabled={m.isPending}>إرسال التقييم</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
