import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Languages, ChevronDown } from "lucide-react";
import { containerVariants, itemVariants } from "@/utils/variants";

interface LanguageSelectorProps {
  isRTL: boolean;
  currentLanguage: string;
  t: (key: string) => string;
  onChangeLanguage: (lng: string) => void;
  availableLanguages?: { value: string; labelKey: string }[];
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  isRTL,
  currentLanguage,
  t,
  onChangeLanguage,
  availableLanguages = [],
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Primary languages + any additional languages from the Probs language
  const languages = [
    { value: "en", label: t("english") },
    { value: "ar", label: t("arabic") },
    ...availableLanguages.map((lang) => ({
      value: lang.value,
      label: t(lang.labelKey) || lang.value.toUpperCase(),
    })),
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (value: string) => {
    onChangeLanguage(value);
    setOpen(false);
  };

  const selectedLabel =
    languages.find((lang) => lang.value === currentLanguage)?.label ??
    t("language");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-2xl w-full mx-auto px-6 space-y-6"
    >
      <motion.div variants={itemVariants}>
        <motion.div
          whileHover={{
            y: -2,
            boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
            borderRadius: "1rem",
          }}
          transition={{ duration: 0.2 }}
        >
          <Card className="p-6 shadow-md transition-all duration-300 bg-card border-border">
            <div
              className={`flex items-center gap-2.5 mb-3 ${
                isRTL ? "flex-row-reverse" : ""
              }`}
            >
              <motion.div
                whileHover={{
                  y: -2,
                  boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
                  borderRadius: "1rem",
                  rotate: 360,
                }}
                transition={{ duration: 0.4 }}
              >
                <Languages className="w-5 h-5 text-primary" />
              </motion.div>
              <label className="text-base text-foreground">
                {t("language")}
              </label>
            </div>
            <div
              className={`relative ${isRTL ? "text-right" : "text-left"}`}
              ref={dropdownRef}
            >
              <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={`${
                  isRTL ? "flex-row-reverse" : ""
                } w-full h-11 bg-input text-foreground border border-border rounded-md px-4 flex items-center justify-between text-sm focus:outline-none focus:ring-2 focus:ring-ring/40`}
                aria-haspopup="listbox"
                aria-expanded={open}
              >
                <span className="truncate">{selectedLabel}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open && (
                <ul
                  role="listbox"
                  className={`absolute z-50 mb-2 w-full rounded-lg border border-border bg-popover text-foreground shadow-xl bottom-full ${
                    isRTL ? "right-0 text-right" : "left-0 text-left"
                  }`}
                  style={{ direction: isRTL ? "rtl" : "ltr" }}
                >
                  {languages.map((language) => (
                    <li key={language.value}>
                      <button
                        type="button"
                        className={`w-full px-4 py-2 text-sm hover:bg-accent/70 focus:bg-accent/80 transition flex items-center justify-between ${
                          currentLanguage === language.value
                            ? "text-primary font-semibold"
                            : ""
                        }`}
                        onClick={() => handleSelect(language.value)}
                      >
                        <span>{language.label}</span>
                        {currentLanguage === language.value && (
                          <span className="text-[10px] uppercase tracking-wider">
                            {t("active")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default LanguageSelector;
