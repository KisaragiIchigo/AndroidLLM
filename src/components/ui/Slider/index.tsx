import * as RadixSlider from '@radix-ui/react-slider';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  label: string;
}

export function Slider({ value, min, max, step, onValueChange, label }: SliderProps) {
  return (
    <RadixSlider.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([next]) => onValueChange(next)}
      className="relative flex h-8 w-full touch-none select-none items-center"
    >
      <RadixSlider.Track className="relative h-[3px] grow rounded-full bg-paper/[0.08]">
        <RadixSlider.Range className="absolute h-full rounded-full bg-gradient-to-r from-lamp-deep to-lamp" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        aria-label={label}
        className="block h-[18px] w-[18px] rounded-full bg-paper shadow-[0_0_0_4px_rgba(226,178,92,0.18),0_0_14px_rgba(226,178,92,0.4)] outline-none"
      />
    </RadixSlider.Root>
  );
}
