import "./App.css";
import { LanguageSelector } from "@/components/shared/LanguageSelector";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Title } from "@/components/shared/Title";

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
};

function App() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  return (
    <Card className="w-md bg-background">
      {/* Header */}
      <header
        className={`flex items-center justify-between px-6 ${
          isRTL ? "flex-row-reverse" : ""
        }`}
      >
        <Title />
        <ThemeToggle />
      </header>
      {/* Main - Hero Section */}
      <main>
        <motion.h1
          variants={itemVariants}
          className="text-3xl pb-6 font-bold text-foreground text-center"
        >
          {t("settings")}
        </motion.h1>
        {/* Section : Language Selection */}
        <LanguageSelector />
      </main>
    </Card>
  );
}

export default App;
