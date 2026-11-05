import * as RadixSwitch from '@radix-ui/react-switch';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, label, disabled }: SwitchProps) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="relative h-6 w-[42px] shrink-0 rounded-full border border-paper/[0.07] bg-black/40 shadow-inset transition-colors disabled:opacity-40 data-[state=checked]:border-lamp/40 data-[state=checked]:bg-lamp/20"
    >
      <RadixSwitch.Thumb className="block h-4 w-4 translate-x-[3px] rounded-full bg-paper-muted transition-transform duration-200 data-[state=checked]:translate-x-[21px] data-[state=checked]:bg-lamp data-[state=checked]:shadow-lamp-strong" />
    </RadixSwitch.Root>
  );
}
