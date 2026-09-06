import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Mail, ShieldCheck, UserCheck, UserCog, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/hooks/use-session";
import {
  createAccount,
  fetchAccounts,
  sendPasswordReset,
  setAccountRole,
  type AccountRole,
} from "@/lib/accounts.functions";
import { logActivity } from "@/lib/audit";
import { PageHeading } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts | Deeper Life Attendance" },
      { name: "description", content: "Manage admin and attendance-taker accounts." },
      { property: "og:title", content: "Accounts | Deeper Life Attendance" },
      { property: "og:description", content: "Manage admin and attendance-taker accounts." },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const { isAdmin, loading, userId } = useSession();
  const queryClient = useQueryClient();

  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    enabled: isAdmin,
  });

  const setRole = useMutation({
    mutationFn: async ({
      userId,
      role,
      accountName,
    }: {
      userId: string;
      role: AccountRole;
      accountName?: string;
    }) => {
      await setAccountRole(userId, role);
      void logActivity({
        action: "role_updated",
        entityType: "account",
        entityId: userId,
        entityTitle: accountName || "User Account",
        details: { role },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Role updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reset = useMutation({
    mutationFn: sendPasswordReset,
    onSuccess: () => toast.success("Reset email sent"),
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading) return null;
  if (!isAdmin) {
    return (
      <div className="surface text-muted-foreground p-10 text-center text-sm">
        Only admins can manage accounts.
      </div>
    );
  }

  return (
    <>
      <PageHeading
        title="Accounts"
        subtitle="Manage roles for registered users."
        action={
          <CreateAccountDialog
            onCreated={() => queryClient.invalidateQueries({ queryKey: ["accounts"] })}
          />
        }
      />

      <ul className="space-y-3">
        {(accounts.data ?? []).map((account) => {
          const isCurrentUser = account.id === userId;
          return (
            <li
              key={account.id}
              className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              {/* Account Info */}
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="bg-primary/10 text-primary grid h-11 w-11 shrink-0 place-items-center rounded-2xl sm:h-12 sm:w-12">
                  <UserCog className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold">{account.name}</span>
                    {isCurrentUser && (
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-0.5 truncate text-xs">
                    {account.email}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 sm:hidden">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        account.role === "admin"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {account.role === "admin" ? (
                        <>
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3 w-3" /> Attendance taker
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-3 sm:border-t-0 sm:pt-0">
                {/* Role Switchers */}
                <div className="bg-secondary/70 grid flex-1 grid-cols-2 gap-1 rounded-xl p-1 sm:flex sm:flex-none">
                  <Button
                    variant={account.role === "admin" ? "default" : "ghost"}
                    size="sm"
                    className={`h-9 px-3 text-xs ${
                      account.role === "admin"
                        ? "shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    disabled={isCurrentUser || setRole.isPending}
                    onClick={() =>
                      setRole.mutate({
                        userId: account.id,
                        role: "admin",
                        accountName: account.name || account.email,
                      })
                    }
                  >
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Admin
                  </Button>
                  <Button
                    variant={account.role === "attendance_taker" ? "default" : "ghost"}
                    size="sm"
                    className={`h-9 px-3 text-xs ${
                      account.role === "attendance_taker"
                        ? "shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    disabled={isCurrentUser || setRole.isPending}
                    onClick={() =>
                      setRole.mutate({
                        userId: account.id,
                        role: "attendance_taker",
                        accountName: account.name || account.email,
                      })
                    }
                  >
                    <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Taker
                  </Button>
                </div>

                {/* Password Reset */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 w-full text-xs sm:w-auto"
                  disabled={reset.isPending}
                  onClick={() => reset.mutate(account.email)}
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" /> Reset password
                </Button>
              </div>
            </li>
          );
        })}
        {accounts.data?.length === 0 && (
          <li className="surface text-muted-foreground p-8 text-center text-sm">
            No accounts yet.
          </li>
        )}
      </ul>
    </>
  );
}

function CreateAccountDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("attendance_taker");
  const create = useMutation({
    mutationFn: async () => {
      const res = await createAccount({ name, email, password, role });
      void logActivity({
        action: "role_updated",
        entityType: "account",
        entityTitle: name || email,
        details: { email, role, action: "account_created" },
      });
      return res;
    },
    onSuccess: () => {
      toast.success("Account created");
      onCreated();
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("attendance_taker");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-11 sm:h-12">
          <UserPlus className="mr-2 h-4 w-4" /> New account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {(["attendance_taker", "admin"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  role === option
                    ? "border-primary bg-primary/8 text-primary font-semibold"
                    : "border-border text-muted-foreground"
                }`}
              >
                {option === "admin" ? "Admin" : "Attendance taker"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-name">Full name</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              value={email}
              autoCapitalize="none"
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-password">Password</Label>
            <Input
              id="account-password"
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-12"
            />
          </div>
          <Button type="submit" size="lg" className="h-12 w-full" disabled={create.isPending}>
            Create account
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
