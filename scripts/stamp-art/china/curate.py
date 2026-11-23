# China stamp list — curated by region (W world-famous · N national favorite · R regional/local favorite)
import json, re, unicodedata, difflib, sys
from collections import Counter, defaultdict
S = sys.argv[1]
# (name, where, province, tier, category)
L = []
def add(region, province, items):
    for name, where, tier, cat in items:
        prov = province if isinstance(province, str) else province.get(where, province.get("*"))
        L.append(dict(name=name, where=where, province=prov, region=region, tier=tier, category=cat))

add("Beijing", "Beijing", [
 ("Great Wall of China","Beijing","W","wall"),("Forbidden City","Beijing","W","palace"),("Temple of Heaven","Beijing","W","temple"),
 ("Summer Palace","Beijing","W","palace"),("Tiananmen Square","Beijing","W","square"),("Badaling Great Wall","Yanqing","N","wall"),
 ("Mutianyu Great Wall","Huairou","N","wall"),("Lama Temple","Beijing","N","temple"),("Beihai Park","Beijing","N","park"),
 ("Jingshan Park","Beijing","N","park"),("Nanluoguxiang","Beijing","N","street"),("Shichahai","Beijing","N","district"),
 ("798 Art District","Beijing","N","district"),("Ming Tombs","Changping","N","heritage"),("Old Summer Palace","Beijing","N","heritage"),
 ("Bird's Nest Stadium","Beijing","N","landmark"),("Universal Beijing Resort","Tongzhou","N","theme park"),("National Museum of China","Beijing","N","museum"),
 ("Wangfujing Street","Beijing","N","street"),("Qianmen Street","Beijing","N","street"),("Prince Gong Mansion","Beijing","N","heritage"),
 ("Gubei Water Town","Miyun","N","old town"),("Beijing Zoo","Beijing","N","wildlife"),("Simatai Great Wall","Miyun","R","wall"),
 ("Juyongguan Great Wall","Changping","R","wall"),("Huanghuacheng Great Wall","Huairou","R","wall"),("Drum Tower and Bell Tower","Beijing","R","landmark"),
 ("Confucius Temple and Imperial College","Beijing","R","temple"),("Fragrant Hills Park","Beijing","R","park"),("Water Cube","Beijing","R","landmark"),
 ("Panjiayuan Antique Market","Beijing","R","market"),("Marco Polo Bridge","Fengtai","R","bridge"),("Tanzhe Temple","Mentougou","R","temple"),
 ("Happy Valley Beijing","Beijing","R","theme park"),("Sanlitun","Beijing","R","district"),
 ("CCTV Headquarters","Beijing","R","landmark"),("National Centre for the Performing Arts","Beijing","R","landmark"),("Yuyuantan Park","Beijing","R","park"),
 ("Longqing Gorge","Yanqing","R","gorge"),
])
add("Tianjin & Hebei", {"Tianjin":"Tianjin","*":"Hebei"}, [
 ("Chengde Mountain Resort","Chengde","W","heritage"),("Tianjin Eye","Tianjin","N","landmark"),("Five Great Avenues","Tianjin","N","district"),
 ("Ancient Culture Street","Tianjin","N","street"),("Italian Style Town","Tianjin","N","district"),("Shanhaiguan Old Dragon's Head","Qinhuangdao","N","wall"),
 ("Beidaihe Beach","Qinhuangdao","N","beach"),("Jinshanling Great Wall","Chengde","N","wall"),("Puning Temple","Chengde","R","temple"),
 ("Putuo Zongcheng Temple","Chengde","R","temple"),("Tianjin Porcelain House","Tianjin","R","landmark"),("Tianjin Binhai Library","Tianjin","R","landmark"),
 ("Zhengding Longxing Temple","Shijiazhuang","R","temple"),("Zhaozhou Bridge","Zhao County","R","bridge"),("Baiyangdian Lake","Baoding","R","lake"),
 ("Xibaipo","Pingshan","R","heritage"),
])
add("Shanghai", "Shanghai", [
 ("The Bund","Shanghai","W","waterfront"),("Oriental Pearl Tower","Shanghai","W","landmark"),("Shanghai Tower","Shanghai","W","landmark"),
 ("Yu Garden","Shanghai","W","garden"),("Shanghai Disneyland","Shanghai","N","theme park"),("Nanjing Road","Shanghai","N","street"),
 ("Lujiazui","Shanghai","N","skyline"),("Xintiandi","Shanghai","N","district"),("Tianzifang","Shanghai","N","district"),
 ("Jade Buddha Temple","Shanghai","N","temple"),("People's Square","Shanghai","N","square"),("Shanghai Museum","Shanghai","N","museum"),
 ("Shanghai World Financial Center","Shanghai","N","landmark"),("Jin Mao Tower","Shanghai","N","landmark"),("Zhujiajiao Water Town","Shanghai","N","old town"),
 ("Former French Concession","Shanghai","N","district"),("Jing'an Temple","Shanghai","N","temple"),
 ("City God Temple of Shanghai","Shanghai","N","temple"),("Shanghai Ocean Aquarium","Shanghai","R","wildlife"),("Longhua Temple","Shanghai","R","temple"),
 ("Qibao Ancient Town","Shanghai","R","old town"),("Century Park","Shanghai","R","park"),("Shanghai Wild Animal Park","Shanghai","R","wildlife"),
 ("M50 Art District","Shanghai","R","district"),("1933 Old Millfun","Shanghai","R","landmark"),("Shanghai Natural History Museum","Shanghai","R","museum"),
 ("Fuxing Park","Shanghai","R","park"),("Wukang Mansion","Shanghai","R","landmark"),("Sheshan","Shanghai","R","mountain"),
 ("Shanghai Science and Technology Museum","Shanghai","R","museum"),("Shanghai Haichang Ocean Park","Shanghai","R","theme park"),
 ("Thames Town","Shanghai","R","district"),
])
add("Jiangsu", "Jiangsu", [
 ("Humble Administrator's Garden","Suzhou","W","garden"),("Zhouzhuang","Suzhou","N","old town"),("Lingering Garden","Suzhou","N","garden"),
 ("Tiger Hill","Suzhou","N","heritage"),("Suzhou Museum","Suzhou","N","museum"),("Pingjiang Road","Suzhou","N","street"),
 ("Shantang Street","Suzhou","N","street"),("Sun Yat-sen Mausoleum","Nanjing","N","heritage"),("Confucius Temple of Nanjing","Nanjing","N","district"),
 ("Ming Xiaoling Mausoleum","Nanjing","N","heritage"),("Nanjing Massacre Memorial Hall","Nanjing","N","museum"),("Lingshan Grand Buddha","Wuxi","N","landmark"),
 ("Slender West Lake","Yangzhou","N","lake"),("Master of the Nets Garden","Suzhou","R","garden"),("Tongli","Suzhou","R","old town"),
 ("Jinji Lake","Suzhou","R","lake"),("Hanshan Temple","Suzhou","R","temple"),("Nanjing City Wall","Nanjing","R","wall"),
 ("Xuanwu Lake","Nanjing","R","lake"),("Presidential Palace","Nanjing","R","heritage"),("Purple Mountain","Nanjing","R","mountain"),
 ("Niushou Mountain","Nanjing","R","temple"),("Zhonghua Gate","Nanjing","R","wall"),("Yuantouzhu","Wuxi","R","park"),
 ("Taihu Lake","Wuxi","R","lake"),("Three Kingdoms City","Wuxi","R","theme park"),("Ge Garden","Yangzhou","R","garden"),
 ("Jinshan Temple","Zhenjiang","R","temple"),("Changzhou Dinosaur Park","Changzhou","R","theme park"),
])
add("Zhejiang", "Zhejiang", [
 ("West Lake","Hangzhou","W","lake"),("Lingyin Temple","Hangzhou","N","temple"),("Leifeng Pagoda","Hangzhou","N","pagoda"),
 ("Hefang Street","Hangzhou","N","street"),("Xixi National Wetland Park","Hangzhou","N","park"),("Longjing Tea Plantations","Hangzhou","N","farm"),
 ("Qiandao Lake","Chun'an","N","lake"),("Wuzhen","Tongxiang","N","old town"),("Xitang","Jiashan","N","old town"),
 ("Putuoshan","Zhoushan","N","temple"),("Songcheng","Hangzhou","N","theme park"),("Hengdian World Studios","Dongyang","N","theme park"),
 ("Nanxun","Huzhou","R","old town"),("Six Harmonies Pagoda","Hangzhou","R","pagoda"),("Hangzhou Grand Canal","Hangzhou","R","canal"),
 ("Tianyi Pavilion","Ningbo","R","heritage"),("Lu Xun's Hometown","Shaoxing","R","heritage"),("Yandang Mountain","Wenzhou","R","mountain"),
 ("Tiantai Mountain","Taizhou","R","mountain"),("Shenxianju","Xianju","R","mountain"),("Moganshan","Deqing","R","mountain"),
 ("Zhujiajian","Zhoushan","R","island"),("Dongqian Lake","Ningbo","R","lake"),("Nanxi River","Wenzhou","R","river"),
 ("South Lake","Jiaxing","R","lake"),
 
])
add("Anhui", "Anhui", [
 ("Huangshan","Huangshan","W","mountain"),("Hongcun Village","Yi County","W","village"),("Xidi","Yi County","N","village"),
 ("Mount Jiuhua","Chizhou","N","mountain"),("Tunxi Old Street","Huangshan","R","street"),("Tangyue Memorial Archways","She County","R","heritage"),
 ("Mount Qiyun","Xiuning","R","mountain"),("Tianzhu Mountain","Anqing","R","mountain"),("Huizhou Ancient City","She County","R","old town"),
 ("Baohe Park","Hefei","R","park"),("Langya Mountain","Chuzhou","R","mountain"),
])
add("Shaanxi", "Shaanxi", [
 ("Terracotta Army","Xi'an","W","heritage"),("Xi'an City Wall","Xi'an","W","wall"),("Mount Hua","Huayin","W","mountain"),
 ("Big Wild Goose Pagoda","Xi'an","N","pagoda"),("Muslim Quarter","Xi'an","N","street"),("Bell Tower of Xi'an","Xi'an","N","landmark"),
 ("Drum Tower of Xi'an","Xi'an","N","landmark"),("Datang Everbright City","Xi'an","N","street"),("Huaqing Palace","Xi'an","N","heritage"),
 ("Shaanxi History Museum","Xi'an","N","museum"),("Hukou Waterfall","Yichuan","N","falls"),("Small Wild Goose Pagoda","Xi'an","R","pagoda"),
 ("Tang Paradise","Xi'an","R","park"),("Xi'an Beilin Museum","Xi'an","R","museum"),("Famen Temple","Baoji","R","temple"),
 ("Qianling Mausoleum","Qian County","R","heritage"),("Pagoda Hill","Yan'an","R","landmark"),("Han Yangling Mausoleum","Xianyang","R","heritage"),
 ("Great Mosque of Xi'an","Xi'an","R","temple"),("Yellow Emperor Mausoleum","Huangling","R","heritage"),("Taibai Mountain","Baoji","R","mountain"),
 ("Qinling Wildlife Park","Xi'an","R","wildlife"),("Tang West Market","Xi'an","R","market"),
])
add("Shanxi", "Shanxi", [
 ("Pingyao Ancient City","Pingyao","W","old town"),("Yungang Grottoes","Datong","W","grottoes"),("Hanging Temple","Hunyuan","N","temple"),
 ("Mount Wutai","Wutai","N","mountain"),("Wang Family Compound","Lingshi","N","heritage"),("Qiao Family Compound","Qi County","N","heritage"),
 ("Yingxian Wooden Pagoda","Yingxian","N","pagoda"),("Datong City Wall","Datong","R","wall"),("Huayan Temple","Datong","R","temple"),
 ("Jinci Temple","Taiyuan","R","temple"),("Mian Mountain","Jiexiu","R","mountain"),("Mount Heng","Hunyuan","R","mountain"),
 ("Shuanglin Temple","Pingyao","R","temple"),("Yanmen Pass","Daixian","R","wall"),("Zhangbi Ancient Castle","Jiexiu","R","heritage"),
])
add("Henan", "Henan", [
 ("Longmen Grottoes","Luoyang","W","grottoes"),("Shaolin Temple","Dengfeng","W","temple"),("White Horse Temple","Luoyang","N","temple"),
 ("Yuntai Mountain","Jiaozuo","N","mountain"),("Millennium City Park","Kaifeng","N","theme park"),("Laojun Mountain","Luanchuan","N","mountain"),
 ("Iron Pagoda","Kaifeng","R","pagoda"),("Songshan","Dengfeng","R","mountain"),("Henan Museum","Zhengzhou","R","museum"),
 ("Yinxu","Anyang","R","heritage"),("Taihang Grand Canyon","Linzhou","R","gorge"),("Guoliang Tunnel","Huixian","R","viewpoint"),
 ("Luoyi Ancient City","Luoyang","R","old town"),("Dragon Pavilion","Kaifeng","R","heritage"),("Erqi Memorial Tower","Zhengzhou","R","landmark"),
 ("Yellow River Scenic Area","Zhengzhou","R","viewpoint"),("Lijing Gate","Luoyang","R","heritage"),
])
add("Shandong", "Shandong", [
 ("Mount Tai","Tai'an","W","mountain"),("Temple of Confucius","Qufu","W","temple"),("Zhanqiao Pier","Qingdao","N","landmark"),
 ("Badaguan","Qingdao","N","district"),("Tsingtao Beer Museum","Qingdao","N","museum"),("Laoshan","Qingdao","N","mountain"),
 ("Baotu Spring","Jinan","N","park"),("Daming Lake","Jinan","N","lake"),("Penglai Pavilion","Yantai","N","heritage"),
 ("May Fourth Square","Qingdao","N","square"),("Liugong Island","Weihai","R","island"),("St. Michael's Cathedral","Qingdao","R","church"),
 ("Thousand Buddha Mountain","Jinan","R","mountain"),("Weifang World Kite Museum","Weifang","R","museum"),("Taierzhuang Ancient Town","Zaozhuang","R","old town"),
 ("Golden Beach","Qingdao","R","beach"),("Yellow River Delta","Dongying","R","wildlife"),("Qingdao Polar Ocean World","Qingdao","R","wildlife"),
 ("Cemetery of Confucius","Qufu","R","heritage"),("Kong Family Mansion","Qufu","R","heritage"),("Yantai Mountain","Yantai","R","park"),
])
add("Sichuan & Chongqing", {"Chongqing":"Chongqing","Wulong":"Chongqing","Dazu":"Chongqing","Fengdu":"Chongqing","Fengjie":"Chongqing","Wansheng":"Chongqing","Nanchuan":"Chongqing","*":"Sichuan"}, [
 ("Chengdu Panda Base","Chengdu","W","wildlife"),("Leshan Giant Buddha","Leshan","W","landmark"),("Jiuzhaigou Valley","Jiuzhaigou","W","lake"),
 ("Mount Emei","Emeishan","W","mountain"),("Hongya Cave","Chongqing","W","landmark"),("Kuanzhai Alley","Chengdu","N","street"),
 ("Jinli Street","Chengdu","N","street"),("Wuhou Shrine","Chengdu","N","temple"),("Du Fu Thatched Cottage","Chengdu","N","heritage"),
 ("Huanglong","Songpan","N","lake"),("Mount Siguniang","Xiaojin","N","mountain"),("Dujiangyan","Dujiangyan","N","heritage"),
 ("Mount Qingcheng","Dujiangyan","N","mountain"),("Ciqikou Ancient Town","Chongqing","N","old town"),("Jiefangbei","Chongqing","N","square"),
 ("Wulong Karst","Wulong","N","landmark"),("Dazu Rock Carvings","Dazu","N","grottoes"),("Three Gorges","Chongqing","N","gorge"),
 ("Liziba Station","Chongqing","N","landmark"),("Nanshan Yikeshu Viewpoint","Chongqing","N","viewpoint"),("Yangtze River Cableway","Chongqing","N","landmark"),
 ("Daocheng Yading","Daocheng","N","mountain"),("Sanxingdui Museum","Guanghan","N","museum"),("Chunxi Road","Chengdu","N","street"),
 ("Taikoo Li Chengdu","Chengdu","N","district"),("Hailuogou Glacier","Luding","R","glacier"),("Mount Gongga","Kangding","R","mountain"),
 ("Bipenggou","Li County","R","mountain"),("Tagong Grassland","Kangding","R","grassland"),("Langzhong Ancient City","Langzhong","R","old town"),
 ("Anshun Bridge","Chengdu","R","bridge"),("Qingyang Palace","Chengdu","R","temple"),("Wenshu Monastery","Chengdu","R","temple"),
 ("Jianmen Pass","Jiange","R","heritage"),("Zigong Dinosaur Museum","Zigong","R","museum"),("Luodai Ancient Town","Chengdu","R","old town"),
 ("Pingle Ancient Town","Qionglai","R","old town"),("Danba Tibetan Villages","Danba","R","village"),("Zoige Grassland","Zoige","R","grassland"),
 ("Mount Wawu","Hongya","R","mountain"),("Huanglongxi Ancient Town","Chengdu","R","old town"),
 ("Xiling Snow Mountain","Dayi","R","mountain"),("Eling Park","Chongqing","R","park"),("Chongqing Zoo","Chongqing","R","wildlife"),
 ("Fengdu Ghost City","Fengdu","R","heritage"),("Baidicheng","Fengjie","R","heritage"),("Black Valley","Wansheng","R","gorge"),
 ("Jinfo Mountain","Nanchuan","R","mountain"),("Chongqing People's Hall","Chongqing","R","landmark"),
 ("Chengdu Giant Panda Breeding Research Base Dujiangyan","Dujiangyan","R","wildlife"),("Bifengxia Panda Base","Ya'an","R","wildlife"),
])
add("Yunnan", "Yunnan", [
 ("Lijiang Old Town","Lijiang","W","old town"),("Stone Forest","Shilin","W","landmark"),("Yuanyang Rice Terraces","Yuanyang","W","viewpoint"),
 ("Jade Dragon Snow Mountain","Lijiang","W","mountain"),("Dali Old Town","Dali","N","old town"),("Erhai Lake","Dali","N","lake"),
 ("Dukezong Old Town","Shangri-La","N","old town"),("Songzanlin Monastery","Shangri-La","N","temple"),("Tiger Leaping Gorge","Shangri-La","N","gorge"),
 ("Xishuangbanna","Jinghong","N","district"),("Lugu Lake","Ninglang","N","lake"),("Three Pagodas of Chongsheng Temple","Dali","N","pagoda"),
 ("Meili Snow Mountain","Deqin","N","mountain"),("Dianchi Lake","Kunming","R","lake"),("Yunnan Nationalities Village","Kunming","R","theme park"),
 ("Manting Park","Jinghong","R","park"),("Wild Elephant Valley","Jinghong","R","wildlife"),("Shuhe Old Town","Lijiang","R","old town"),
 ("Xizhou Ancient Town","Dali","R","old town"),("Shaxi Old Town","Jianchuan","R","old town"),("Nuodeng","Yunlong","R","village"),
 ("Pudacuo National Park","Shangri-La","R","park"),("Heshun Ancient Town","Tengchong","R","old town"),("Tengchong Volcanic Geopark","Tengchong","R","volcano"),
 ("Yuanmou Earth Forest","Yuanmou","R","landmark"),("Jianshui Ancient Town","Jianshui","R","old town"),("Puzhehei","Qiubei","R","lake"),
 ("Luoping Canola Fields","Luoping","R","farm"),("Dongchuan Red Land","Kunming","R","viewpoint"),("Green Lake Park","Kunming","R","park"),
 ("Western Hills Dragon Gate","Kunming","R","viewpoint"),("Yunnan Provincial Museum","Kunming","R","museum"),("Black Dragon Pool","Lijiang","R","park"),
 ("Blue Moon Valley","Lijiang","R","lake"),("Lashi Lake","Lijiang","R","lake"),("Kunming Golden Temple","Kunming","R","temple"),
])
add("Guangxi", "Guangxi", [
 ("Li River","Guilin","W","river"),("Yangshuo","Yangshuo","W","landmark"),("Reed Flute Cave","Guilin","W","cave"),
 ("Detian Falls","Daxin","W","falls"),("Longji Rice Terraces","Longsheng","W","viewpoint"),("Elephant Trunk Hill","Guilin","N","landmark"),
 ("Yulong River","Yangshuo","N","river"),("West Street","Yangshuo","N","street"),("Weizhou Island","Beihai","N","island"),
 ("Silver Beach","Beihai","N","beach"),("Two Rivers and Four Lakes","Guilin","R","waterfront"),("Sun and Moon Pagodas","Guilin","R","pagoda"),
 ("Xingping Ancient Town","Yangshuo","R","old town"),("Silver Cave","Lipu","R","cave"),("Impression Liu Sanjie","Yangshuo","R","theme park"),
 ("Moon Hill","Yangshuo","R","landmark"),("Qingxiu Mountain","Nanning","R","park"),("Huangyao Ancient Town","Zhaoping","R","old town"),
 ("Chengyang Wind and Rain Bridge","Sanjiang","R","bridge"),("Daxu Ancient Town","Guilin","R","old town"),("Seven Star Park","Guilin","R","park"),
 ("Bama","Bama","R","village"),("Huashan Rock Art","Ningming","R","heritage"),("Jingjiang Princes' Palace","Guilin","R","heritage"),
 ("Fubo Hill","Guilin","R","landmark"),
])
add("Guangdong", "Guangdong", [
 ("Canton Tower","Guangzhou","W","landmark"),("Kaiping Diaolou","Kaiping","N","heritage"),("Danxia Mountain","Shaoguan","N","mountain"),
 ("Chimelong Paradise","Guangzhou","N","theme park"),("Chimelong Safari Park","Guangzhou","N","wildlife"),("Shamian Island","Guangzhou","N","district"),
 ("Chen Clan Ancestral Hall","Guangzhou","N","heritage"),("Window of the World","Shenzhen","N","theme park"),("Ping An Finance Centre","Shenzhen","N","landmark"),
 ("Chimelong Ocean Kingdom","Zhuhai","N","theme park"),("Chaozhou Ancient City","Chaozhou","N","old town"),("Guangji Bridge","Chaozhou","N","bridge"),
 ("Shangxiajiu Pedestrian Street","Guangzhou","R","street"),("Beijing Road","Guangzhou","R","street"),("Yuexiu Park","Guangzhou","R","park"),
 ("Sun Yat-sen Memorial Hall","Guangzhou","R","heritage"),("Baiyun Mountain","Guangzhou","R","mountain"),("Guangzhou Opera House","Guangzhou","R","landmark"),
 ("Temple of the Six Banyan Trees","Guangzhou","R","temple"),("Huacheng Square","Guangzhou","R","square"),("Splendid China Folk Village","Shenzhen","R","theme park"),
 ("OCT Harbour","Shenzhen","R","district"),("Happy Valley Shenzhen","Shenzhen","R","theme park"),("Dameisha Beach","Shenzhen","R","beach"),
 ("Shenzhen Bay Park","Shenzhen","R","park"),("Lianhuashan Park","Shenzhen","R","park"),("Dafen Oil Painting Village","Shenzhen","R","village"),
 ("Nantou Ancient Town","Shenzhen","R","old town"),("Wutong Mountain","Shenzhen","R","mountain"),("Xichong Beach","Shenzhen","R","beach"),
 ("Sea World Shekou","Shenzhen","R","district"),("Dapeng Fortress","Shenzhen","R","heritage"),("Fisher Girl Statue","Zhuhai","R","landmark"),
 ("Lovers' Road","Zhuhai","R","waterfront"),("Seven Star Crags","Zhaoqing","R","park"),("Dinghu Mountain","Zhaoqing","R","mountain"),
 ("Nan'ao Island","Shantou","R","island"),("Foshan Ancestral Temple","Foshan","R","temple"),("Lingnan Tiandi","Foshan","R","district"),
 ("Huizhou West Lake","Huizhou","R","lake"),("Hailing Island","Yangjiang","R","island"),("Luofu Mountain","Huizhou","R","mountain"),
])
add("Fujian", "Fujian", [
 ("Fujian Tulou","Yongding","W","heritage"),("Gulangyu","Xiamen","W","island"),("Mount Wuyi","Wuyishan","W","mountain"),
 ("Xiamen University","Xiamen","N","campus"),("Nanputuo Temple","Xiamen","N","temple"),("Quanzhou Kaiyuan Temple","Quanzhou","N","temple"),
 ("Three Lanes and Seven Alleys","Fuzhou","N","district"),("Zhongshan Road","Xiamen","R","street"),("Zengcuo'an","Xiamen","R","village"),
 ("Huandao Road","Xiamen","R","waterfront"),("Hulishan Fortress","Xiamen","R","heritage"),("Quanzhou West Street","Quanzhou","R","street"),
 ("Chongwu Ancient Town","Quanzhou","R","old town"),("Gushan","Fuzhou","R","mountain"),("Xiapu Mudflats","Xiapu","R","viewpoint"),
 ("Taimu Mountain","Fuding","R","mountain"),("Meizhou Island","Putian","R","island"),("Pingtan Island","Pingtan","R","island"),
 ("Yunshuiyao","Nanjing County","R","village"),("Taining","Taining","R","landmark"),("Dongshan Island","Dongshan","R","island"),
])
add("Hainan", "Hainan", [
 ("Yalong Bay","Sanya","N","beach"),("Tianya Haijiao","Sanya","N","landmark"),("Wuzhizhou Island","Sanya","N","island"),
 ("Nanshan Temple","Sanya","N","temple"),("Sanya Bay","Sanya","R","beach"),("Dadonghai","Sanya","R","beach"),
 ("Haitang Bay","Sanya","R","beach"),("Atlantis Sanya","Sanya","R","theme park"),("Luhuitou Park","Sanya","R","park"),
 ("Yanoda Rainforest","Baoting","R","park"),("Qilou Old Street","Haikou","R","street"),("Haikou Volcanic Cluster Geopark","Haikou","R","volcano"),
 ("Boao","Qionghai","R","waterfront"),("Wuzhishan","Wuzhishan","R","mountain"),("Fenjiezhou Island","Lingshui","R","island"),
 ("Holiday Beach","Haikou","R","beach"),("Xinglong Tropical Botanical Garden","Wanning","R","garden"),("Shimei Bay","Wanning","R","beach"),
])
add("Hunan", "Hunan", [
 ("Zhangjiajie National Forest Park","Zhangjiajie","W","mountain"),("Tianmen Mountain","Zhangjiajie","W","mountain"),("Fenghuang Ancient Town","Fenghuang","W","old town"),
 ("Zhangjiajie Glass Bridge","Zhangjiajie","N","bridge"),("Tianzi Mountain","Zhangjiajie","N","mountain"),("Yuanjiajie","Zhangjiajie","N","viewpoint"),
 ("Furong Town","Yongshun","N","old town"),("Orange Isle","Changsha","N","park"),("Yuelu Mountain","Changsha","N","mountain"),
 ("Yuelu Academy","Changsha","N","heritage"),("Mount Heng Nanyue","Hengyang","N","mountain"),("Yueyang Tower","Yueyang","N","heritage"),
 ("Baofeng Lake","Zhangjiajie","R","lake"),("Yellow Dragon Cave","Zhangjiajie","R","cave"),("Hunan Museum","Changsha","R","museum"),
 ("Taiping Street","Changsha","R","street"),("Shaoshan","Shaoshan","R","heritage"),("Dongting Lake","Yueyang","R","lake"),
 ("Langshan","Xinning","R","mountain"),("Aizhai Bridge","Jishou","R","bridge"),("Dehang Miao Village","Jishou","R","village"),
 ("Qianyang Ancient City","Hongjiang","R","old town"),
])
add("Hubei", "Hubei", [
 ("Three Gorges Dam","Yichang","W","landmark"),("Wudang Mountains","Shiyan","W","mountain"),("Yellow Crane Tower","Wuhan","N","landmark"),
 ("East Lake","Wuhan","N","lake"),("Shennongjia","Shennongjia","N","mountain"),("Enshi Grand Canyon","Enshi","N","gorge"),
 ("Hubei Provincial Museum","Wuhan","R","museum"),("Wuhan Yangtze River Bridge","Wuhan","R","bridge"),("Hubu Alley","Wuhan","R","street"),
 ("Guiyuan Temple","Wuhan","R","temple"),("Wuhan University","Wuhan","R","campus"),("Jianghan Road","Wuhan","R","street"),
 ("Tenglong Cave","Lichuan","R","cave"),("Xiling Gorge","Yichang","R","gorge"),("Three Gorges Tribe","Yichang","R","theme park"),
 ("Jingzhou Ancient City","Jingzhou","R","old town"),("Mulan Tianchi","Wuhan","R","park"),("Qingjiang Gallery","Changyang","R","river"),
 
])
add("Jiangxi", "Jiangxi", [
 ("Lushan","Jiujiang","N","mountain"),("Wuyuan","Wuyuan","N","village"),("Taoxichuan Ceramic Art Avenue","Jingdezhen","N","district"),
 ("Mount Sanqing","Shangrao","N","mountain"),("Tengwang Pavilion","Nanchang","N","heritage"),("Longhu Mountain","Yingtan","R","mountain"),
 ("Poyang Lake","Jiujiang","R","lake"),("Jinggangshan","Ji'an","R","mountain"),("Wugong Mountain","Pingxiang","R","mountain"),
 ("Huangling","Wuyuan","R","village"),("Bayi Square","Nanchang","R","square"),("Guifeng","Yiyang","R","mountain"),
 ("Jingdezhen Ancient Kiln Folk Customs Museum","Jingdezhen","R","museum"),
])
add("Guizhou", "Guizhou", [
 ("Huangguoshu Waterfall","Anshun","W","falls"),("Fanjingshan","Tongren","W","mountain"),("Xijiang Qianhu Miao Village","Leishan","N","village"),
 ("Zhaoxing Dong Village","Liping","N","village"),("Libo Xiaoqikong","Libo","N","falls"),("Qingyan Ancient Town","Guiyang","R","old town"),
 ("Jiaxiu Tower","Guiyang","R","landmark"),("Zhenyuan Ancient Town","Zhenyuan","R","old town"),("Wanfenglin","Xingyi","R","viewpoint"),
 ("Malinghe Canyon","Xingyi","R","gorge"),("Dragon Palace Cave","Anshun","R","cave"),("Zhijin Cave","Zhijin","R","cave"),
 ("Chishui Waterfall","Chishui","R","falls"),("FAST Telescope","Pingtang","R","landmark"),("Qianling Mountain Park","Guiyang","R","park"),
 ("Hongfeng Lake","Guiyang","R","lake"),("Tianlong Tunbao","Anshun","R","village"),("Basha Miao Village","Congjiang","R","village"),
 ("Getu River","Ziyun","R","gorge"),
])
add("Gansu · Qinghai · Ningxia", {"Xining":"Qinghai","Gonghe":"Qinghai","Ulan":"Qinghai","Guide":"Qinghai","Menyuan":"Qinghai","Qilian":"Qinghai","Zhongwei":"Ningxia","Yinchuan":"Ningxia","Shizuishan":"Ningxia","*":"Gansu"}, [
 ("Mogao Caves","Dunhuang","W","grottoes"),("Zhangye Danxia","Zhangye","W","landmark"),("Crescent Lake and Mingsha Dunes","Dunhuang","W","desert"),
 ("Jiayuguan Pass","Jiayuguan","N","wall"),("Labrang Monastery","Xiahe","N","temple"),("Maijishan Grottoes","Tianshui","N","grottoes"),
 ("Qinghai Lake","Gonghe","N","lake"),("Chaka Salt Lake","Ulan","N","lake"),("Kumbum Monastery","Xining","N","temple"),
 ("Shapotou","Zhongwei","N","desert"),("Yadan National Geopark","Dunhuang","R","landmark"),("Yumen Pass","Dunhuang","R","heritage"),
 ("Bingling Temple Grottoes","Yongjing","R","grottoes"),("Zhongshan Bridge","Lanzhou","R","bridge"),("Waterwheel Garden","Lanzhou","R","park"),
 ("Zhuoer Mountain","Qilian","R","mountain"),("Mati Temple","Zhangye","R","grottoes"),("Guide National Geopark","Guide","R","landmark"),
 ("Menyuan Rapeseed Fields","Menyuan","R","farm"),("Dongguan Mosque","Xining","R","temple"),("Sand Lake","Shizuishan","R","lake"),
 ("Western Xia Imperial Tombs","Yinchuan","R","heritage"),("Helan Mountain Rock Art","Yinchuan","R","heritage"),("Zhenbeibu Western Film Studio","Yinchuan","R","theme park"),
 ("Langmusi","Luqu","R","village"),("Zhagana","Diebu","R","village"),
])
add("Xinjiang", "Xinjiang", [
 ("Kashgar Old City","Kashgar","N","old town"),("Id Kah Mosque","Kashgar","N","temple"),("Heavenly Lake of Tianshan","Fukang","N","lake"),
 ("Kanas Lake","Burqin","N","lake"),("Flaming Mountains","Turpan","N","landmark"),("Sayram Lake","Bortala","N","lake"),
 ("Urumqi International Grand Bazaar","Urumqi","N","market"),("Jiaohe Ruins","Turpan","R","heritage"),("Grape Valley","Turpan","R","farm"),
 ("Karakul Lake","Akto","R","lake"),("Bayanbulak Grassland","Hejing","R","grassland"),("Narat Grassland","Xinyuan","R","grassland"),
 ("Hemu Village","Burqin","R","village"),("Tashkurgan Stone City","Tashkurgan","R","heritage"),("Karakoram Highway","Tashkurgan","R","viewpoint"),
 ("Kalajun Grassland","Tekes","R","grassland"),("Duku Highway","Dushanzi","R","viewpoint"),("Wucaitan Rainbow Beach","Burqin","R","landmark"),
 ("Kizil Caves","Baicheng","R","grottoes"),("Urho Ghost City","Karamay","R","landmark"),("Taklamakan Desert Highway","Minfeng","R","desert"),
 ("Tianshan Grand Canyon","Kuqa","R","gorge"),("Apak Hoja Tomb","Kashgar","R","heritage"),("Yili Lavender Fields","Huocheng","R","farm"),
 ("Bezeklik Thousand Buddha Caves","Turpan","R","grottoes"),("Emin Minaret","Turpan","R","landmark"),
])
add("Tibet", "Tibet", [
 ("Potala Palace","Lhasa","W","palace"),("Jokhang Temple","Lhasa","W","temple"),("Barkhor Street","Lhasa","N","street"),
 ("Namtso Lake","Damxung","N","lake"),("Yamdrok Lake","Nagarze","N","lake"),("Sera Monastery","Lhasa","N","temple"),
 ("Drepung Monastery","Lhasa","N","temple"),("Tashilhunpo Monastery","Shigatse","N","temple"),("Everest Base Camp","Tingri","N","mountain"),
 ("Mount Kailash","Burang","N","mountain"),("Norbulingka","Lhasa","R","palace"),("Ganden Monastery","Dagze","R","temple"),
 ("Samye Monastery","Zhanang","R","temple"),("Lulang","Nyingchi","R","viewpoint"),("Basum Tso","Gongbo'gyamda","R","lake"),
 ("Yarlung Tsangpo Grand Canyon","Nyingchi","R","gorge"),("Lake Manasarovar","Burang","R","lake"),("Karola Glacier","Nagarze","R","glacier"),
 ("Gyantse Kumbum","Gyantse","R","temple"),("Tibet Museum","Lhasa","R","museum"),("Guge Kingdom Ruins","Zanda","R","heritage"),
])
add("Inner Mongolia", "Inner Mongolia", [
 ("Hulunbuir Grassland","Hulunbuir","N","grassland"),("Xiangshawan","Ordos","N","desert"),("Genghis Khan Mausoleum","Ordos","N","heritage"),
 ("Dazhao Temple","Hohhot","R","temple"),("Arxan National Forest Park","Arxan","R","park"),("Xilamuren Grassland","Hohhot","R","grassland"),
 ("Matryoshka Square","Manzhouli","R","theme park"),("Enhe Russian Ethnic Township","Ergun","R","village"),("Badain Jaran Desert","Alxa","R","desert"),
 ("Ejina Populus Euphratica Forest","Ejina","R","viewpoint"),("Inner Mongolia Museum","Hohhot","R","museum"),("Wulanbutong Grassland","Chifeng","R","grassland"),
 ("Wudangzhao Monastery","Baotou","R","temple"),("Xanadu","Zhenglan Banner","R","heritage"),("Asihatu Stone Forest","Chifeng","R","landmark"),
])
add("Northeast", {"Harbin":"Heilongjiang","Shangzhi":"Heilongjiang","Hailin":"Heilongjiang","Mudanjiang":"Heilongjiang","Wudalianchi":"Heilongjiang","Mohe":"Heilongjiang","Antu":"Jilin","Jilin":"Jilin","Changchun":"Jilin","Ji'an":"Jilin","*":"Liaoning"}, [
 ("Harbin Ice and Snow World","Harbin","W","theme park"),("Saint Sophia Cathedral","Harbin","N","church"),("Central Street","Harbin","N","street"),
 ("China Snow Town","Hailin","N","village"),("Changbai Mountain","Antu","N","mountain"),("Puppet Emperor's Palace","Changchun","N","museum"),
 ("Shenyang Imperial Palace","Shenyang","N","palace"),("Xinghai Square","Dalian","N","square"),("Yalu River Broken Bridge","Dandong","N","bridge"),
 ("Sun Island","Harbin","R","park"),("Yabuli Ski Resort","Shangzhi","R","mountain"),("Harbin Polarland","Harbin","R","wildlife"),
 ("Jingpo Lake","Mudanjiang","R","lake"),("Wudalianchi","Wudalianchi","R","volcano"),("Rime Island","Jilin","R","viewpoint"),
 ("Jingyuetan","Changchun","R","park"),("Zhang Zuolin Mansion","Shenyang","R","heritage"),("Zhongjie Pedestrian Street","Shenyang","R","street"),
 ("Binhai Road","Dalian","R","waterfront"),("Tiger Beach Ocean Park","Dalian","R","wildlife"),("Discoveryland","Dalian","R","theme park"),
 ("Jinshitan","Dalian","R","beach"),("Hushan Great Wall","Dandong","R","wall"),("Jade Buddha Palace","Anshan","R","temple"),
 ("Benxi Water Cave","Benxi","R","cave"),("Qianshan","Anshan","R","mountain"),("Lüshun","Dalian","R","heritage"),
 ("Xingcheng Ancient City","Huludao","R","old town"),("Arctic Village","Mohe","R","village"),("Ji'an Koguryo Sites","Ji'an","R","heritage"),
 
])

for i,p in enumerate(L,1): p['n']=i
rank={'W':0,'N':1,'R':2}
# ---------- matching ----------
def norm(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode()
    s=re.sub(r'\([^)]*\)',' ',s).lower().replace("'",'').replace('’','')
    s=re.sub(r'[^a-z0-9]+',' ',s).strip()
    return s
STOP={'the','of','and','mount','mountain','mountains','ancient','old','town','city','scenic','area','national','park','forest','spot','temple','grand','great','river','lake','island','beach','street','road','village','museum'}
def core(s):
    t=[w for w in norm(s).split() if w not in STOP]
    return ' '.join(t) or norm(s)
def slug(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode()
    s=re.sub(r'\([^)]*\)',' ',s).lower().replace("'",'').replace('’','')
    return re.sub(r'^-+|-+$','',re.sub(r'[^a-z0-9]+','-',s))
rows=json.load(open(f'{S}/cn-rows.json'))
ALIAS = json.load(open(f'{S}/aliases.json')) if __import__('os').path.exists(f'{S}/aliases.json') else {}
by_norm=defaultdict(list); by_core=defaultdict(list)
for r in rows:
    by_norm[norm(r['name'])].append(r); by_core[core(r['name'])].append(r)
def pick(cands, where):
    if not cands: return None
    w=norm(where)
    sc=sorted(cands, key=lambda r:(0 if w and (w in norm(r.get('city')) or norm(r.get('city')) in w) else 1, 0 if r.get('scope') in ('world','national','regional') else 1))
    return sc[0]
report=[]
for p in L:
    r=None; how=''
    if p['name'] in ALIAS:
        a=ALIAS[p['name']]
        r=next((x for x in rows if x['id']==a), None) if a else None; how='alias'
    if r is None and p['name'] not in ALIAS:
        c=by_norm.get(norm(p['name'])); 
        if c: r=pick(c,p['where']); how='exact'
        if r is None:
            c=by_core.get(core(p['name']))
            if c: r=pick(c,p['where']); how='core'
        if r is None:
            best=difflib.get_close_matches(norm(p['name']), list(by_norm.keys()), n=3, cutoff=0.88)
            if best: r=pick(by_norm[best[0]],p['where']); how='fuzzy:'+best[0]
    p['dbId']=r['id'] if r else ''; p['dbName']=r['name'] if r else ''; p['dbScope']=r.get('scope') if r else ''; p['dbCity']=r.get('city') if r else ''
    p['status']=('Stampable today' if r and r.get('scope') in ('world','national','regional') else 'Exists — needs promotion' if r else 'Missing — needs a database row')
    p['how']=how; p['file']=slug(p['name'])+'.png'
    if not r:
        best=difflib.get_close_matches(norm(p['name']), list(by_norm.keys()), n=3, cutoff=0.6)
        report.append((p['n'],p['name'],p['where'],[(b, by_norm[b][0].get('city'), by_norm[b][0].get('scope')) for b in best]))
# icon rows that exist in production (the 2026-11-08 revive) but not in this Sept-28 export: take them from art-matches
am=json.load(open('/Users/lobster/Developer/globeskimmers/scripts/stamp-art/art-matches.json'))['places']
am_cn={p_['art']:p_ for p_ in am if p_.get('cc')=='CN'}
def _core(s): return core(s)
for p in L:
    if p['dbId']: continue
    s=slug(p['name']); hit=am_cn.get(s) or next((v for v in am_cn.values() if _core(v['name'])==_core(p['name'])), None)
    if hit and hit.get('same'):
        p['dbId']=hit['same'][0]; p['dbName']=hit['name']; p['dbScope']='icon'; p['status']='Stampable today (icon row)'; p['how']='art-matches'
# art
art=json.load(open(f'{S}/cn-art.json'))
artslugs={a[2]:a[1] for a in art}
artbyname={slug(a[1]):a[2] for a in art}          # "Huangshan (Yellow Mountains)" → huangshan
SHARE={"Humble Administrator's Garden":"suzhou-classical-gardens","Tianzi Mountain":"wulingyuan","Yuanjiajie":"wulingyuan",
 "Badaling Great Wall":"great-wall-of-china","Mutianyu Great Wall":"great-wall-of-china","Jinshanling Great Wall":"great-wall-of-china",
 "Simatai Great Wall":"great-wall-of-china","Juyongguan Great Wall":"great-wall-of-china","Huanghuacheng Great Wall":"great-wall-of-china","Hushan Great Wall":"great-wall-of-china"}
for p in L:
    s=slug(p['name']); p['art']=''
    if p['name']=="Zhangjiajie National Forest Park": p['art']='zhangjiajie.png'
    elif s in artslugs: p['art']=s+'.png'
    elif s in artbyname: p['art']=artbyname[s]+'.png'
    elif p['name'] in SHARE: p['art']='shares '+SHARE[p['name']]+'.png'
json.dump(L, open(f'{S}/china-list.json','w'), ensure_ascii=False, indent=1)
c=Counter(p['tier'] for p in L); st=Counter(p['status'] for p in L)
print("total", len(L), dict(c)); print(dict(st)); print("art already:", sum(1 for p in L if p['art']))
print("\nUNMATCHED (n, name, where, close DB names):")
for n,name,where,best in report: print(n, '|', name, '|', where, '|', best)
