import { Sparkles } from "lucide-react"

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 ${
        light ? "text-white" : "text-[#101827]"
      }`}
    >
      <span
        className={`grid size-8 place-items-center rounded-[10px] ${
          light ? "bg-white text-[#101827]" : "bg-[#101827] text-white"
        }`}
      >
        <Sparkles size={15} strokeWidth={2.3} />
      </span>
      <span className="text-[18px] font-semibold tracking-[-0.04em]">
        Leanie
      </span>
    </div>
  )
}
