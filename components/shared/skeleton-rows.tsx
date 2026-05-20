interface Props {
  count?: number;
}

export function SkeletonRows({ count = 3 }: Props) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="list-row" style={{ cursor: "default" }}>
          <div className="list-row__title">
            <span
              className="skeleton"
              style={{ display: "block", height: 14, marginBottom: 8, width: "60%" }}
            />
            <span
              className="skeleton"
              style={{ display: "block", height: 10, width: "40%" }}
            />
          </div>
          <span
            className="skeleton"
            style={{ display: "block", height: 12, width: 90 }}
          />
          <span
            className="skeleton"
            style={{ borderRadius: 999, display: "block", height: 22, width: 70 }}
          />
          <span
            className="skeleton"
            style={{ display: "block", height: 11, width: 100 }}
          />
          <span
            className="skeleton"
            style={{ borderRadius: 4, display: "block", height: 16, width: 16 }}
          />
        </div>
      ))}
    </>
  );
}
