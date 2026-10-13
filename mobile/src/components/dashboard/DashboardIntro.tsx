import { Text, View } from "react-native";
import { Icon, s } from "../ui";
import { styles } from "./styles";

export function DashboardIntro() {
  return (
    <>
      <View>
        <Text style={styles.eyebrow}>YOUR RELAY, AT A GLANCE</Text>
        <Text style={styles.heading}>Everything in transit.</Text>
        <Text style={s.body}>Small stop. Next destination.</Text>
      </View>
      <View style={styles.intake}>
        <View style={styles.intakeIcon}>
          <Icon name="share-2" size={23} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.title}>Share it here.</Text>
          <Text style={s.body}>
            In Files, Photos, or another app, tap Share → File Relay. Any file
            type, up to 200 MB.
          </Text>
        </View>
      </View>
    </>
  );
}
