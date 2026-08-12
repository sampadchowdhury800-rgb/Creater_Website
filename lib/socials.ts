export interface SocialLink {
  label: string;
  url: string;
  icon: string;
  color?: string;
}

export interface SocialGroup {
  platform: string;
  links: SocialLink[];
}

export const socialGroups: SocialGroup[] = [
  {
    platform: "Instagram",
    links: [
      {
        label: "chowdhury_duo",
        url: "https://www.instagram.com/chowdhury_duo?igsh=Zm12dTViZ2VyZDNi",
        icon: "photo_camera",
        color: "#E1306C",
      },
      {
        label: "sampad_chowdhury999",
        url: "https://www.instagram.com/sampad_chowdhury999?igsh=eTZoZDBqa3N6bGRr",
        icon: "photo_camera",
        color: "#E1306C",
      },
      {
        label: "_sambha_creation",
        url: "https://www.instagram.com/_sambha_creation?igsh=OTZiYXdtazNyeTM0",
        icon: "photo_camera",
        color: "#E1306C",
      },
      {
        label: "her_editss_",
        url: "https://www.instagram.com/_her_editss_?igsh=aWE0ZmIxN3ZvNmtj",
        icon: "photo_camera",
        color: "#E1306C",
      },
      {
        label: "Bharti",
        url: "https://www.instagram.com/_._._bharti_._._?igsh=MTZhMm94dWZ4YmdtNw==",
        icon: "photo_camera",
        color: "#E1306C",
      },
    ],
  },
  {
    platform: "Facebook",
    links: [
      {
        label: "Sambha Creation",
        url: "https://www.facebook.com/share/18pN5KsRwf/",
        icon: "group",
        color: "#1877F2",
      },
      {
        label: "Chowdhury Duo",
        url: "https://www.facebook.com/share/18gotfoK3k/",
        icon: "group",
        color: "#1877F2",
      },
    ],
  },
  {
    platform: "YouTube",
    links: [
      {
        label: "Sambha Creation",
        url: "https://youtube.com/@sambhaanimation?si=QWlxu0nued5PLlgp",
        icon: "play_circle",
        color: "#FF0000",
      },
      {
        label: "Chowdhury Duo",
        url: "https://youtube.com/@chowdhuryduo?si=redpyWSUosMK10Qz",
        icon: "play_circle",
        color: "#FF0000",
      },
    ],
  },
];
