import { useForm } from "@tanstack/react-form";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { REPORT_CADENCES } from "@/server/features/agency/contracts";
import {
  getAgencySettings,
  saveAgencyBrand,
  saveAgencyClient,
} from "@/server/features/agency/functions";

// Agency settings (ADR-017 §1–2): white-label brand for client reports
// (organization-wide) and the client record for this project.

const settingsQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["agency", projectId],
    queryFn: () => getAgencySettings({ data: { projectId } }),
  });

type Settings = Awaited<ReturnType<typeof getAgencySettings>>;
type Logo = { contentType: string; base64: string } | null;

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

function TextField({
  name,
  label,
  value,
  onChange,
  type = "text",
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function AgencySettings({ projectId }: { projectId: string }) {
  const query = useQuery(settingsQuery(projectId));
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader
          title="Agency"
          description="Your brand on client reports, and who this project's client is."
        />
        <QueryState
          query={query}
          errorFallback="Failed to load agency settings"
        >
          {(settings) => (
            <>
              <BrandCard projectId={projectId} settings={settings} />
              <ClientCard projectId={projectId} settings={settings} />
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}

function BrandCard({
  projectId,
  settings,
}: {
  projectId: string;
  settings: Settings;
}) {
  const queryClient = useQueryClient();
  const [logo, setLogo] = useState<Logo>(null);
  const brand = settings.brand;
  const save = useMutation({
    mutationFn: (value: typeof form.state.values) =>
      saveAgencyBrand({
        data: {
          projectId,
          agencyName: value.agencyName,
          accentColor: value.accentColor,
          contactLine: orNull(value.contactLine),
          footerText: orNull(value.footerText),
          hideOpenseoCredit: value.hideOpenseoCredit,
          logo,
          removeLogo: value.removeLogo,
        },
      }),
    onSuccess: async (result) => {
      setLogo(null);
      toast.success(
        result.logoTooLarge
          ? "Saved. The logo is over 50 KB, so reports show your agency name instead."
          : "Brand saved.",
      );
      await queryClient.invalidateQueries({ queryKey: ["agency", projectId] });
    },
    onError: () => toast.error("Could not save the brand."),
  });
  const form = useForm({
    defaultValues: {
      agencyName: brand?.agencyName ?? "",
      accentColor: brand?.accentColor ?? "#1a1a1a",
      contactLine: brand?.contactLine ?? "",
      footerText: brand?.footerText ?? "",
      hideOpenseoCredit: brand?.hideOpenseoCredit ?? true,
      removeLogo: false,
    },
    onSubmit: ({ value }) => save.mutate(value),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return setLogo(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    setLogo({ contentType: file.type, base64: btoa(binary) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand</CardTitle>
        <CardDescription>
          Shown on every client report from this organization. Logo: PNG, JPEG,
          WebP or GIF up to 50 KB; larger logos fall back to your agency name.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="agencyName">
            {(field) => (
              <TextField
                name={field.name}
                label="Agency name"
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="accentColor">
            {(field) => (
              <TextField
                name={field.name}
                label="Accent color"
                type="color"
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="contactLine">
            {(field) => (
              <TextField
                name={field.name}
                label="Contact line"
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="footerText">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Footer text</FieldLabel>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <Field>
            <FieldLabel htmlFor="agency-logo">Logo</FieldLabel>
            {brand?.logoDataUri ? (
              <img
                src={brand.logoDataUri}
                alt="Current logo"
                className="max-h-12"
              />
            ) : null}
            <Input
              id="agency-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </Field>
          <form.Field name="removeLogo">
            {(field) => (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.state.value}
                  onChange={(event) => field.handleChange(event.target.checked)}
                />
                Remove the current logo
              </label>
            )}
          </form.Field>
          <form.Field name="hideOpenseoCredit">
            {(field) => (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.state.value}
                  onChange={(event) => field.handleChange(event.target.checked)}
                />
                Hide the "Prepared with OpenSEO" credit
              </label>
            )}
          </form.Field>
          <Button type="submit" disabled={save.isPending}>
            Save brand
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ClientCard({
  projectId,
  settings,
}: {
  projectId: string;
  settings: Settings;
}) {
  const queryClient = useQueryClient();
  const client = settings.client;
  const save = useMutation({
    mutationFn: (value: typeof form.state.values) =>
      saveAgencyClient({
        data: {
          projectId,
          clientName: value.clientName,
          contactName: orNull(value.contactName),
          contactEmail: orNull(value.contactEmail),
          reportCadence: value.reportCadence,
          notes: orNull(value.notes),
        },
      }),
    onSuccess: async () => {
      toast.success("Client saved.");
      await queryClient.invalidateQueries({ queryKey: ["agency", projectId] });
    },
    onError: () => toast.error("Could not save the client."),
  });
  const form = useForm({
    defaultValues: {
      clientName: client?.clientName ?? "",
      contactName: client?.contactName ?? "",
      contactEmail: client?.contactEmail ?? "",
      reportCadence: client?.reportCadence ?? "none",
      notes: client?.notes ?? "",
    },
    onSubmit: ({ value }) => save.mutate(value),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client</CardTitle>
        <CardDescription>
          Who receives this project's reports, and how often.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="clientName">
            {(field) => (
              <TextField
                name={field.name}
                label="Client name"
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="contactName">
            {(field) => (
              <TextField
                name={field.name}
                label="Contact name"
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="contactEmail">
            {(field) => (
              <TextField
                name={field.name}
                label="Contact email"
                type="email"
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="reportCadence">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Report cadence</FieldLabel>
                <select
                  id={field.name}
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(
                      REPORT_CADENCES.find((c) => c === event.target.value) ??
                        "none",
                    )
                  }
                >
                  <option value="none">None</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </Field>
            )}
          </form.Field>
          <form.Field name="notes">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Notes</FieldLabel>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <Button type="submit" disabled={save.isPending}>
            Save client
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
