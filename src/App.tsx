import "./App.css";
import LanguageSelector from "@/components/shared/LanguageSelector";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Card } from "@/components/ui/card";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Title } from "@/components/shared/Title";
import WatcherToggleCard from "./components/shared/WatcherToggleCard";
import AdsSkippedCard from "./components/shared/AdsSkippedCard";
import AdControlSettingsCard from "./components/shared/AdControlSettingsCard";
import { useWatcherSetting } from "@/hooks/useWatcherSetting";
import { itemVariants } from "@/utils/variants";

function App() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const currentLanguage: string = i18n.language;
  const { watcherEnabled, setWatcherEnabled, isLoading } = useWatcherSetting();

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="w-full">
      <Card className="w-sm mx-auto bg-background border-0 shadow-none py-4">
        {/* Header */}
        <header className="flex items-center justify-between px-6">
          <Title t={t} />
          <ThemeToggle />
        </header>
        {/* Main - Hero Section */}
        <main>
          <WatcherToggleCard
            watcherEnabled={watcherEnabled}
            setWatcherEnabled={setWatcherEnabled}
            isLoading={isLoading}
            currentLanguage={currentLanguage}
            t={t}
          />
          <AdsSkippedCard t={t} watcherEnabled={watcherEnabled} />
          <motion.h1
            variants={itemVariants}
            className="text-3xl py-6 font-bold text-foreground text-center"
          >
            {t("settings")}
          </motion.h1>
          <AdControlSettingsCard
            watcherEnabled={watcherEnabled}
            isRTL={isRTL}
            t={t}
          />
          {/* Section : Language Selection */}
          <LanguageSelector
            currentLanguage={currentLanguage}
            onChangeLanguage={i18n.changeLanguage}
            t={t}
          />
        </main>
      </Card>
    </div>
  );
}

export default App;
