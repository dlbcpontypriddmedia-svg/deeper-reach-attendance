import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  CalendarPlus,
  ChevronRight,
  MoreVertical,
  Pencil,
  Repeat,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  attendanceQuery,
  getServiceVisitorTotal,
  membersQuery,
  servicesQuery,
  type Service,
  type ServiceType,
} from "@/lib/data";
import { PageHeading } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Services | Deeper Life Attendance" },
      { name: "description", content: "Create services and take attendance in real time." },
      { property: "og:title", content: "Services | Deeper Life Attendance" },
      { property: "og:description", content: "Create services and take attendance in real time." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(servicesQuery);
  },
  component: ServicesPage,
});

function ServicesPage() {
  const { data: services } = useSuspenseQuery(servicesQuery);
  const members = useQuery(membersQuery);
  const attendance = useQuery(attendanceQuery);
  const { isAdmin } = useSession();
  const [page, setPage] = useState(1);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);

  const perPage = 10;
  const pageCount = Math.max(1, Math.ceil(services.length / perPage));
  const current = Math.min(page, pageCount);
  const paged = services.slice((current - 1) * perPage, current * perPage);

  const counts = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>();
    for (const record of attendance.data ?? []) {
      const entry = map.get(record.service_id) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (record.status === "present") entry.present += 1;
      map.set(record.service_id, entry);
    }
    return map;
  }, [attendance.data]);

  return (
    <>
      <PageHeading title="Services" action={<NewServiceDialog />} />

      {services.length === 0 ? (
        <div className="surface p-10 text-center">
          <Sparkles className="text-primary mx-auto h-6 w-6" />
          <p className="font-display mt-3 text-lg">No services yet</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {paged.map((service) => {
            const count = counts.get(service.id);
            const visitors = getServiceVisitorTotal(service);
            const totalPresent = (count?.present ?? 0) + visitors;
            const pct = count?.total ? Math.round((count.present / count.total) * 100) : null;
            return (
              <li
                key={service.id}
                className="surface hover:shadow-lift relative flex items-center transition-shadow"
              >
                <Link
                  to="/attendance/$serviceId"
                  params={{ serviceId: service.id }}
                  className="flex flex-1 items-center gap-4 p-4 sm:p-5"
                >
                  <div className="bg-secondary text-secondary-foreground grid h-14 w-14 shrink-0 place-items-center rounded-2xl">
                    <span className="text-[10px] tracking-widest uppercase opacity-70">
                      {format(parseISO(service.date), "MMM")}
                    </span>
                    <span className="font-display -mt-0.5 text-xl leading-none font-semibold">
                      {format(parseISO(service.date), "d")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{service.name}</div>
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                      {service.type === "recurring" ? (
                        <>
                          <Repeat className="h-3 w-3" /> Recurring
                        </>
                      ) : (
                        <>One-off</>
                      )}
                      <span aria-hidden>·</span>
                      {format(parseISO(service.date), "EEEE d MMMM yyyy")}
                      {visitors > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="bg-accent/15 text-accent-foreground flex items-center gap-1 rounded-full px-2 py-0.5 font-medium">
                            <Users className="h-3 w-3" /> +{visitors} visitors
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {pct === null ? (
                      <span className="bg-accent/15 text-accent-foreground rounded-full px-3 py-1 text-xs font-semibold">
                        Not taken
                      </span>
                    ) : (
                      <>
                        <div className="font-display text-primary text-xl font-semibold">
                          {totalPresent}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {count!.present}/{count!.total} members ({pct}%)
                        </div>
                      </>
                    )}
                  </div>
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                </Link>

                <div className="pr-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-full"
                        aria-label="Service actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingService(service)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit / Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingService(service)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="h-11"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            {current} / {pageCount}
          </span>
          <Button
            variant="secondary"
            size="lg"
            className="h-11"
            disabled={current === pageCount}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <EditServiceDialog service={editingService} onClose={() => setEditingService(null)} />
      <DeleteServiceDialog service={deletingService} onClose={() => setDeletingService(null)} />
    </>
  );
}

function NewServiceDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ServiceType>("recurring");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(4);

  const create = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getUser();
      const rows = [];
      const total = type === "recurring" && repeat ? Math.min(Math.max(weeks, 1), 26) : 1;
      const start = parseISO(date);
      for (let i = 0; i < total; i += 1) {
        const day = new Date(start);
        day.setDate(start.getDate() + i * 7);
        rows.push({
          name,
          type,
          date: format(day, "yyyy-MM-dd"),
          created_by: session.user?.id ?? null,
        });
      }
      const { error } = await supabase.from("services").insert(rows);
      if (error) throw new Error(error.message);
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success(count > 1 ? `${count} services created` : "Service created");
      setOpen(false);
      setName("");
      setRepeat(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12">
          <CalendarPlus className="mr-2 h-4 w-4" /> New service
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New service</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {(["recurring", "one_off"] as ServiceType[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  type === option
                    ? "border-primary bg-primary/8 text-primary font-semibold"
                    : "border-border text-muted-foreground"
                }`}
              >
                {option === "recurring" ? "Recurring" : "One-off"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-name">Service name</Label>
            <Input
              id="service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-date">Date</Label>
            <Input
              id="service-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-12"
            />
          </div>
          {type === "recurring" && (
            <div className="bg-secondary/60 space-y-3 rounded-xl p-3">
              <label className="flex items-center gap-3 text-sm">
                <Checkbox checked={repeat} onCheckedChange={(v) => setRepeat(v === true)} />
                Repeat weekly
              </label>
              {repeat && (
                <div className="flex items-center gap-3">
                  <Label htmlFor="weeks" className="text-xs">
                    Weeks
                  </Label>
                  <Input
                    id="weeks"
                    type="number"
                    min={1}
                    max={26}
                    value={weeks}
                    onChange={(e) => setWeeks(Number(e.target.value))}
                    className="h-10 w-20"
                  />
                </div>
              )}
            </div>
          )}
          <Button type="submit" size="lg" className="h-12 w-full" disabled={create.isPending}>
            Create service
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditServiceDialog({
  service,
  onClose,
}: {
  service: Service | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<ServiceType>("recurring");
  const [date, setDate] = useState("");

  useMemo(() => {
    if (service) {
      setName(service.name);
      setType(service.type);
      setDate(service.date);
    }
  }, [service]);

  const update = useMutation({
    mutationFn: async () => {
      if (!service) return;
      const { error } = await supabase
        .from("services")
        .update({
          name: name.trim(),
          type,
          date,
        })
        .eq("id", service.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["service", service?.id] });
      toast.success("Service updated");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(service)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit service</DialogTitle>
          <DialogDescription>Update the name, date, or type of this service.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {(["recurring", "one_off"] as ServiceType[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  type === option
                    ? "border-primary bg-primary/8 text-primary font-semibold"
                    : "border-border text-muted-foreground"
                }`}
              >
                {option === "recurring" ? "Recurring" : "One-off"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-service-name">Service name</Label>
            <Input
              id="edit-service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-service-date">Date</Label>
            <Input
              id="edit-service-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="lg" className="h-12 flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="h-12 flex-1" disabled={update.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteServiceDialog({
  service,
  onClose,
}: {
  service: Service | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: async () => {
      if (!service) return;
      const { error } = await supabase.from("services").delete().eq("id", service.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Service deleted");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(service)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete service?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong className="text-foreground">{service?.name}</strong>?
            This will also delete all attendance records associated with this service. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="secondary" size="lg" className="h-12 flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="h-12 flex-1"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}