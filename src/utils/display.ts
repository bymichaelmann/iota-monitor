import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import type { Ora } from "ora";

/**
 * Create a spinner with a given message.
 */
export function spinner(text: string): Ora {
  return ora({ text, color: "cyan" });
}

/**
 * Render a simple two-column key-value table.
 */
export function keyValueTable(rows: [string, string][], title?: string): string {
  const maxKeyLen = Math.max(...rows.map(([k]) => k.length));
  const table = new Table({
    style: { head: [], border: [] },
    colWidths: [maxKeyLen + 4, undefined],
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  });

  if (title) {
    const titleTable = new Table({
      style: { head: [], border: [] },
      chars: {
        top: "─",
        "top-mid": "┬",
        "top-left": "┌",
        "top-right": "┐",
        bottom: "─",
        "bottom-mid": "┴",
        "bottom-left": "└",
        "bottom-right": "┘",
        left: "│",
        "left-mid": "├",
        mid: "─",
        "mid-mid": "┼",
        right: "│",
        "right-mid": "┤",
        middle: "│",
      },
    });
    titleTable.push([{ colSpan: 2, content: chalk.bold.cyan(title), hAlign: "center" }]);
    for (const [key, value] of rows) {
      titleTable.push([chalk.bold(key), value]);
    }
    return titleTable.toString();
  }

  for (const [key, value] of rows) {
    table.push([chalk.bold(key), value]);
  }
  return table.toString();
}

/**
 * Render a table with column headers for list data.
 */
export function columnTable(headers: string[], rows: string[][]): string {
  const table = new Table({
    head: headers.map((h) => chalk.bold.cyan(h)),
    style: { head: [], border: [] },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  });
  for (const row of rows) {
    table.push(row);
  }
  return table.toString();
}

/**
 * Print a success message.
 */
export function success(message: string): void {
  console.log(chalk.green("✓"), message);
}

/**
 * Print an error message.
 */
export function error(message: string): void {
  console.error(chalk.red("✗"), message);
}

/**
 * Print an info message.
 */
export function info(message: string): void {
  console.log(chalk.blue("ℹ"), message);
}

/**
 * Print a warning message.
 */
export function warn(message: string): void {
  console.log(chalk.yellow("⚠"), message);
}

/**
 * Format status with color.
 */
export function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "success":
      return chalk.green(status);
    case "failure":
    case "failed":
      return chalk.red(status);
    case "pending":
      return chalk.yellow(status);
    default:
      return status;
  }
}
