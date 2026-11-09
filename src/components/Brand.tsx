export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? "text-white" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="brand-name">
        LeanIE <b className={light ? "text-white/55" : ""}>Plan</b>
      </span>
    </span>
  )
}
