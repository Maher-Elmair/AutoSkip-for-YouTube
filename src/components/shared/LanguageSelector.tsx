import { useId } from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Languages } from "lucide-react";
import { containerVariants, itemVariants } from "@/utils/variants";
import { supportedLanguages } from "@/i18n/languages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const labelId = useId();

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
              <span id={labelId} className="text-base text-foreground">
                {t("language")}
              </span>
            </div>
            <Select
              value={currentLanguage}
              onValueChange={onChangeLanguage}
              dir={direction}
            >
              <SelectTrigger
                aria-labelledby={labelId}
                className="w-full h-11 bg-input text-foreground border-border px-4"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top" className="max-h-64">
                {supportedLanguages.map(({ code, nativeName }) => (
                  <SelectItem key={code} value={code}>
                    <bdi lang={code}>{nativeName}</bdi>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default LanguageSelector;
