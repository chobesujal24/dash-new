import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  numeric?: boolean;
  width?: string;
  hideBelow?: "sm";
};

type TableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  label: string;
  className?: string;
};

/** Quiet data table used for saved-versus-live comparisons. */
export function Table<T>({ columns, rows, rowKey, empty = "Nothing to show yet.", label, className }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-[12px]", className)}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "eyebrow px-5 py-2 font-medium",
                  column.numeric && "text-right",
                  column.hideBelow === "sm" && "max-sm:hidden",
                )}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-6 text-center text-[12px] text-mute">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={rowKey(row, index)} className="border-b border-line transition-colors last:border-0 hover:bg-panel-2/40">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-5 py-2.5 align-middle", column.numeric && "text-right", column.hideBelow === "sm" && "max-sm:hidden")}
                  >
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
