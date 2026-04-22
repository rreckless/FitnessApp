export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  WorkoutLogger: undefined;
  ProgressTracking: undefined;
  Leaderboard: undefined;
  Achievements: undefined;
  GPSTracking: undefined;
  BodyTracking: undefined;
  RestTimer: undefined;
  RouteePlanning: undefined;
  HomeWidgets: undefined;
  SocialFeatures: undefined;
  ChallengeCenter: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = {
  navigation: any;
  route: any;
};
