import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/features/settings/context/ThemeContext";

export default function NotFoundScreen() {
  const { c } = useTheme();
  const { t } = useI18n();

  return (
    <>
      <Stack.Screen options={{ title: t("notFound.title") }} />
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <Text style={[styles.title, { color: c.text }]}>
          {t("notFound.body")}
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: c.primary }]}>
            {t("notFound.goHome")}
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
