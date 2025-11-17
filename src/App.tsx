import "./App.css";
import LanguageSelector from "@/components/shared/LanguageSelector";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Title } from "@/components/shared/Title";
import WatcherToggleCard from "./components/shared/WatcherToggleCard";
import { useState } from "react";
import { itemVariants } from "@/utils/variants";

function App() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const currentLanguage = i18n.language;
  const [watcherEnabled, setWatcherEnabled] = useState(false);

  return (
    <Card className="w-md bg-background">
      {/* Header */}
      <header
        className={`flex items-center justify-between px-6 ${
          isRTL ? "flex-row-reverse" : ""
        }`}
      >
        <Title isRTL={isRTL} t={t} />
        <ThemeToggle />
      </header>
      {/* Main - Hero Section */}
      <main>
        <WatcherToggleCard
          watcherEnabled={watcherEnabled}
          setWatcherEnabled={setWatcherEnabled}
          currentLanguage={i18n.language}
          isRTL={isRTL}
          t={t}
        />
        <motion.h1
          variants={itemVariants}
          className="text-3xl py-6 font-bold text-foreground text-center"
        >
          {t("settings")}
        </motion.h1>
        {/* Section : Language Selection */}
        <LanguageSelector
          currentLanguage={currentLanguage}
          onChangeLanguage={i18n.changeLanguage}
          isRTL={isRTL}
          t={t}
        />
      </main>
    </Card>
  );
}

export default App;
