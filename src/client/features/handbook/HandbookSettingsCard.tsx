import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Field, FieldLabel } from "@/client/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Switch } from "@/client/components/ui/switch";
import { updateHandbookSettings } from "@/server/features/handbook/functions";
import { handbookSettingsQuery } from "./queries";

type Settings = Awaited<ReturnType<typeof updateHandbookSettings>>;
type ProjectMode = "BUILD" | "AUDIT" | "MAINTAIN";

const MODE_ITEMS: { value: ProjectMode; label: string }[] = [
  { value: "AUDIT", label: "Audit (existing site)" },
  { value: "BUILD", label: "Build (new site)" },
  { value: "MAINTAIN", label: "Maintain (recurring)" },
];
const TIER_ITEMS = [
  { value: "auto", label: "Inferred from the site" },
  { value: "T1", label: "T1 · single page" },
  { value: "T2", label: "T2 · small site" },
  { value: "T3", label: "T3 · collections" },
  { value: "T4", label: "T4 · commerce / accounts" },
] as const;
type TierValue = (typeof TIER_ITEMS)[number]["value"];

const isProjectMode = (v: string | null): v is ProjectMode =>
  MODE_ITEMS.some((m) => m.value === v);
const isTierValue = (v: string | null): v is TierValue =>
  TIER_ITEMS.some((t) => t.value === v);

export function HandbookSettingsCard({
  projectId,
  settings,
}: {
  projectId: string;
  settings: Settings;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (value: {
      enabled: boolean;
      mode: ProjectMode;
      tier: TierValue;
      copyQuality: boolean;
    }) =>
      updateHandbookSettings({
        data: {
          projectId,
          enabled: value.enabled,
          mode: value.mode,
          tierOverride: value.tier === "auto" ? null : value.tier,
          copyQuality: value.copyQuality,
          serpOriginality: settings.serpOriginality,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: handbookSettingsQuery(projectId).queryKey,
      });
      toast.success("Handbook settings saved");
    },
    onError: () => toast.error("Could not save handbook settings"),
  });

  const defaultValues: {
    enabled: boolean;
    mode: ProjectMode;
    tier: TierValue;
    copyQuality: boolean;
  } = {
    enabled: settings.enabled,
    mode: settings.mode === "REVIEW" ? "AUDIT" : settings.mode,
    tier: settings.tierOverride ?? "auto",
    copyQuality: settings.copyQuality,
  };
  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => mutation.mutate(value),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Handbook audit</CardTitle>
        <CardDescription>
          Runs the SEO/GEO handbook checks after each site audit of this
          project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-3 sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="enabled">
            {(field) => (
              <Field orientation="horizontal">
                <Switch
                  id="handbook-enabled"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
                <FieldLabel htmlFor="handbook-enabled">Enabled</FieldLabel>
              </Field>
            )}
          </form.Field>
          <form.Field name="mode">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="handbook-mode">Mode</FieldLabel>
                <Select
                  items={MODE_ITEMS}
                  value={field.state.value}
                  onValueChange={(v) => {
                    if (isProjectMode(v)) field.handleChange(v);
                  }}
                >
                  <SelectTrigger id="handbook-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>
          <form.Field name="tier">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="handbook-tier">Tier</FieldLabel>
                <Select
                  items={TIER_ITEMS}
                  value={field.state.value}
                  onValueChange={(v) => {
                    if (isTierValue(v)) field.handleChange(v);
                  }}
                >
                  <SelectTrigger id="handbook-tier" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIER_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>
          <form.Field name="copyQuality">
            {(field) => (
              <Field orientation="horizontal" className="sm:col-span-3">
                <Switch
                  id="handbook-copy-quality"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
                <FieldLabel htmlFor="handbook-copy-quality">
                  Copy quality (wording patterns, not scored)
                </FieldLabel>
              </Field>
            )}
          </form.Field>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
