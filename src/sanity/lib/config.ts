/**
 * Importer Worker 的網址。部署後可在此填入預設值,
 * 例如 'https://my-photo-blog-importer.<account>.workers.dev'。
 * 留空時,BatchPhotoInput 會要求在介面上輸入一次(存在瀏覽器 localStorage)。
 */
export const DEFAULT_IMPORTER_URL = 'https://my-photo-blog-importer.qazxsw9295.workers.dev';

/** localStorage 鍵名,用來記住使用者輸入的 importer 網址。 */
export const IMPORTER_URL_STORAGE_KEY = 'photoBlog.importerUrl';
