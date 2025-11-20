import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      data-testid="button-theme-toggle"
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5" data-testid="icon-moon" />
      ) : (
        <Sun className="w-5 h-5" data-testid="icon-sun" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
