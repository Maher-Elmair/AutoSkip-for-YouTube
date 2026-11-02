import { useId } from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { ChevronDown, Languages } from "lucide-react";
import { containerVariants, itemVariants } from "@/utils/variants";
import { supportedLanguages } from "@/i18n/languages";

interface LanguageSelectorProps {
  currentLanguage: string;
  direction: "ltr" | "rtl";
  t: (key: string) => string;
  onChangeLanguage: (lng: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  direction,
  t,
  onChangeLanguage,
}) => {
  const selectId = useId();

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
            boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
            borderRadius: "1rem",
          }}
          transition={{ duration: 0.2 }}
        >
          <Card className="p-6 shadow-md transition-all duration-300 bg-card border-border">
            <div className="flex items-center gap-2.5 mb-3">
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
              <label htmlFor={selectId} className="text-base text-foreground">
                {t("language")}
              </label>
            </div>
            <div className="relative">
              {/* A native menu also works in Chrome's toolbar popup without
                  a portalled overlay or document scroll locking. */}
              <select
                id={selectId}
                value={currentLanguage}
                onChange={(event) => onChangeLanguage(event.target.value)}
                dir={direction}
                className="w-full h-11 appearance-none rounded-md border border-border bg-input ps-4 pe-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {supportedLanguages.map(({ code, nativeName }) => (
                  <option key={code} value={code} lang={code}>
                    {nativeName}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default LanguageSelector;
