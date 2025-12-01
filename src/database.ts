import mongoose, { Schema, Document } from 'mongoose';

export interface IKeyword extends Document {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  sheetType: string;
  keywordType: 'restaurant' | 'pet' | 'basic'; // 키워드 타입 구분
  lastChecked: Date;
  restaurantName?: string;
  matchedTitle?: string;
  postVendorName?: string;
  rank?: number;
  rankWithCafe?: number; // 인기글인 경우 카페 포함 순위
  isUpdateRequired?: boolean; // 포스트 수정 필요 여부 (식당 키워드만)
  createdAt: Date;
  updatedAt: Date;
}

const KeywordSchema: Schema = new Schema(
  {
    company: { type: String, required: true },
    keyword: { type: String, required: true },
    visibility: { type: Boolean, default: false },
    popularTopic: { type: String, default: '' },
    url: { type: String, default: '' },
    sheetType: { type: String, default: 'package' },
    keywordType: { type: String, enum: ['restaurant', 'pet', 'basic'], default: 'basic' },
    lastChecked: { type: Date, default: Date.now },
    restaurantName: { type: String, default: '' },
    matchedTitle: { type: String, default: '' },
    postVendorName: { type: String, default: '' },
    rank: { type: Number, default: 0 },
    rankWithCafe: { type: Number, default: 0 }, // 인기글인 경우 카페 포함 순위
    isUpdateRequired: { type: Boolean, default: false }, // 포스트 수정 필요 여부
  },
  {
    timestamps: true,
  }
);

export const Keyword = mongoose.model<IKeyword>('Keyword', KeywordSchema);

export interface IRootKeyword extends Document {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  keywordType: 'restaurant' | 'pet' | 'basic';
  lastChecked: Date;
  restaurantName?: string;
  matchedTitle?: string;
  postVendorName?: string;
  rank?: number;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RootKeywordSchema: Schema = new Schema(
  {
    company: { type: String, required: true },
    keyword: { type: String, required: true },
    visibility: { type: Boolean, default: false },
    popularTopic: { type: String, default: '' },
    url: { type: String, default: '' },
    keywordType: { type: String, enum: ['restaurant', 'pet', 'basic'], default: 'basic' },
    lastChecked: { type: Date, default: Date.now },
    restaurantName: { type: String, default: '' },
    matchedTitle: { type: String, default: '' },
    postVendorName: { type: String, default: '' },
    rank: { type: Number, default: 0 },
    rankWithCafe: { type: Number, default: 0 },
    isUpdateRequired: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export const RootKeyword = mongoose.model<IRootKeyword>('RootKeyword', RootKeywordSchema);

export const connectDB = async (uri: string): Promise<void> => {
  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB 연결 성공');
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB 연결 종료');
  } catch (error) {
    console.error('❌ MongoDB 연결 종료 실패:', error);
  }
};

export const getAllKeywords = async (): Promise<IKeyword[]> => {
  try {
    const keywords = await Keyword.find({});
    console.log(`✅ 총 ${keywords.length}개 키워드 로드`);
    return keywords;
  } catch (error) {
    console.error('❌ 키워드 로드 실패:', error);
    throw error;
  }
};

export const getAllRootKeywords = async (): Promise<IRootKeyword[]> => {
  try {
    const keywords = await RootKeyword.find({});
    console.log(`✅ 총 ${keywords.length}개 루트 키워드 로드`);
    return keywords;
  } catch (error) {
    console.error('❌ 루트 키워드 로드 실패:', error);
    throw error;
  }
};

export const updateKeywordResult = async (
  keywordId: string,
  visibility: boolean,
  popularTopic: string,
  url: string,
  keywordType: 'restaurant' | 'pet' | 'basic',
  restaurantName?: string,
  matchedTitle?: string,
  rank?: number,
  postVendorName?: string,
  rankWithCafe?: number,
  isUpdateRequired?: boolean
): Promise<void> => {
  try {
    const update: Partial<IKeyword> = {
      visibility,
      popularTopic,
      url,
      keywordType,
      lastChecked: new Date(),
    } as Partial<IKeyword>;

    if (typeof restaurantName !== 'undefined')
      update.restaurantName = restaurantName;
    if (typeof matchedTitle !== 'undefined') update.matchedTitle = matchedTitle;
    if (typeof rank !== 'undefined') update.rank = rank;
    if (typeof postVendorName !== 'undefined')
      update.postVendorName = postVendorName;
    if (typeof rankWithCafe !== 'undefined') update.rankWithCafe = rankWithCafe;
    if (typeof isUpdateRequired !== 'undefined')
      update.isUpdateRequired = isUpdateRequired;

    await Keyword.findByIdAndUpdate(keywordId, update);
  } catch (error) {
    console.error('❌ 키워드 업데이트 실패:', error);
    throw error;
  }
};

export const updateRootKeywordResult = async (
  keywordId: string,
  visibility: boolean,
  popularTopic: string,
  url: string,
  keywordType: 'restaurant' | 'pet' | 'basic',
  restaurantName?: string,
  matchedTitle?: string,
  rank?: number,
  postVendorName?: string,
  rankWithCafe?: number,
  isUpdateRequired?: boolean
): Promise<void> => {
  try {
    const update: Partial<IRootKeyword> = {
      visibility,
      popularTopic,
      url,
      keywordType,
      lastChecked: new Date(),
    } as Partial<IRootKeyword>;

    if (typeof restaurantName !== 'undefined')
      update.restaurantName = restaurantName;
    if (typeof matchedTitle !== 'undefined') update.matchedTitle = matchedTitle;
    if (typeof rank !== 'undefined') update.rank = rank;
    if (typeof postVendorName !== 'undefined')
      update.postVendorName = postVendorName;
    if (typeof rankWithCafe !== 'undefined') update.rankWithCafe = rankWithCafe;
    if (typeof isUpdateRequired !== 'undefined')
      update.isUpdateRequired = isUpdateRequired;

    await RootKeyword.findByIdAndUpdate(keywordId, update);
  } catch (error) {
    console.error('❌ 루트 키워드 업데이트 실패:', error);
    throw error;
  }
};
