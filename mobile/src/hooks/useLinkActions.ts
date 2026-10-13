import { Linking, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { errorMessage } from "../lib/errors";

export function useLinkActions(
  onNotice: (message: string) => void,
  onError: (message: string) => void,
) {
  async function copy(url: string) {
    try {
      await Clipboard.setStringAsync(url);
      onNotice("Download link copied");
    } catch (error) {
      onError(errorMessage(error));
    }
  }
  async function share(url: string) {
    try {
      await Share.share({ message: url });
    } catch (error) {
      onError(errorMessage(error));
    }
  }
  async function download(url: string) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      onError(errorMessage(error));
    }
  }
  return { copy, share, download };
}
