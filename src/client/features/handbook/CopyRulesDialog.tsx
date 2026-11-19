import { Check, Copy } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/client/components/ui/dialog";
import { useCopy } from "@/client/hooks/useCopy";
import copyRules from "@/server/features/handbook/copy-rules.json";

/**
 * Copy rules pack (fork/skills/copy-rules, ADR-024): the rules to give a
 * writer or model before rewriting page copy for content findings.
 */
export function CopyRulesDialog() {
  const { copied, copy } = useCopy();
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Copy rules
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Copy rules ({copyRules.version})</DialogTitle>
          <DialogDescription>
            Give these to the writer or AI assistant before rewriting page copy
            for content findings.
          </DialogDescription>
        </DialogHeader>
        <pre
          data-testid="copy-rules-text"
          className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs"
        >
          {copyRules.text}
        </pre>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => void copy(copyRules.text, "Copy rules copied")}
          >
            {copied ? <Check /> : <Copy />}
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
