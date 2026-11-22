export const APP_COPY = {
  share: {
    buttonLabel: "Share this avatar",
    buttonTooltip: "Share your avatar's design — not your app or data.",
    modalTitle: "Share this avatar",
    modalExplainer:
      "This shares your avatar's design — not your app, chats, or memory.",
    privacyFootnote:
      "Your chats, memory, and personal data are never included in shares.",
    actionShare: {
      label: "Share this avatar",
      helperPrefix: "Anyone with this link sees",
      helperSuffix: "exactly as you designed it.",
      toast: "Link copied. Paste it anywhere.",
    },
    actionCopyData: {
      label: "Copy avatar data",
      helper:
        "For developers. Copies the raw configuration string — not a link.",
      toast: "Avatar data copied to clipboard.",
    },
    actionDuplicate: {
      label: "Duplicate this avatar",
      helper: "Starts a fresh copy in your studio. Your original stays untouched.",
      toast: "Duplicated. Edit freely — your original is safe.",
    },
    emptyState: {
      title: "Your avatar is still the default.",
      body: "Customize it first to make it truly yours — or share it as-is.",
      primary: "Customize first",
      secondary: "Share anyway",
      customizeToast:
        "Try changing the archetype or picking a new persona — then share when it feels like you.",
      shareAnywayToast:
        "Link copied. Share away — you can always customize later.",
    },
  },
  duplicateBanner: {
    normal: {
      text: "You're viewing an avatar shared by someone else. Want to make it your own?",
      primary: "Duplicate & customize",
      secondary: "Keep viewing",
      toast: "Duplicated. This is now yours to edit.",
    },
    empty: {
      text: "You're viewing an avatar shared by someone else. Make it your starting point — or build your own from scratch.",
      primary: "Make it mine",
      secondary: "Build my own",
      makeItMineToast: "Done. This is now your avatar — edit anything you like.",
      buildOwnToast: "Fresh start. Design an avatar that feels like you.",
    },
  },
  originChip: {
    label: "Started from a shared avatar",
    tooltipBody:
      "You duplicated this avatar from a shared link. The person who shared it still has their original — this copy is only yours.",
    tooltipFootnote:
      "Edit anything to make it fully yours. This note disappears after your first change.",
  },
  gentleNudge: {
    A: {
      text: "This avatar started from someone else's design. Want to make it more yours? Try changing the archetype or persona.",
      primary: "Customize now",
    },
    B: {
      text: "Curious what this avatar would look like as a different archetype? One click, and it's a whole new vibe.",
      primary: "See other archetypes",
    },
    C: {
      text: "This is your avatar now — but it still has someone else's fingerprints. A small change makes it feel like yours.",
      primary: "Make it mine",
    },
    D: {
      text: "No rush. But when you're ready, a small tweak makes this avatar feel like you.",
      primary: "Customize",
    },
    dismiss: "Not now",
  },
} as const;

export type GentleNudgeVariant = "A" | "B" | "C" | "D";
