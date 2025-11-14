export interface TiltifyUserResponse {
    data: {
        user: TiltifyUser;
    };
}

export interface TiltifyUser {
    __typename: "User";
    avatar: UserImage;
    createdAt: string;
    description: string | null;
    id: number;
    slug: string;
    social: UserSocial;
    teamMemberships: TeamMembership[];
    totalAmountRaised: Currency;
    username: string;
}

export interface UserImage {
    __typename: "Image";
    alt: string;
    src: string;
}

export interface UserSocial {
    __typename: "UserSocial";
    discord: string | null;
    facebook: string | null;
    instagram: string | null;
    linkedin: string | null;
    snapchat: string | null;
    tiktok: string | null;
    twitch: string | null;
    twitter: string | null;
    website: string | null;
    youtube: string | null;
}

export interface TeamMembership {
    __typename: "TeamMembership";
    publicId: string;
    roles: Role[];
    team: Team;
}

export interface Role {
    __typename: "Role";
    description: string;
    name: string;
    publicId: string;
}

export interface Team {
    __typename: "Team";
    avatar: TeamImage;
    description: string;
    id: number;
    memberCount: number;
    name: string;
    publicId: string;
    slug: string;
    totalAmountRaised: Currency;
}

export interface TeamImage {
    __typename: "Image";
    alt: string;
    height: number;
    src: string;
    width: number;
}

export interface Currency {
    __typename: "Currency";
    currency: string;
    value: string;
}

