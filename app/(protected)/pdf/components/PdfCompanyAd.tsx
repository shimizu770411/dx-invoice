export function PdfCompanyAd() {
    return (
        <div
            className="w-full border border-x-0 border-t-2 border-black px-2 py-0.5 font-bold"
            style={{ fontFamily: '"Noto Sans JP", sans-serif', letterSpacing: '-0.1rem' }}
        >
            <div className="grid items-center gap-x-2" style={{ gridTemplateColumns: '0.6fr 0.15fr 1.1fr' }}>
                <div className="text-[0.7rem] leading-[1.4]" style={{ letterSpacing: '-0.2rem' }}>
                    <div className="flex justify-between">
                        {'\u3231 日本フェニックス'.split('').map((c, j) => (
                            <span key={j}>{c}</span>
                        ))}
                    </div>
                    {/* 漢字は字幅が広く、外側の字詰め指定のままだと重なるため、この行だけ字詰めを解除する */}
                    <div className="flex" style={{ letterSpacing: 0 }}>
                        <span>総合葬祭</span>
                        <span className="ml-1 flex flex-1 justify-between">
                            {'玉泉院'.split('').map((c, j) => (
                                <span key={j}>{c}</span>
                            ))}
                        </span>
                    </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/freedial.png" alt="フリーダイヤル" className="ml-1.5 h-auto max-h-6 object-contain" />
                <div className="text-right text-2xl" style={{ transform: 'scale(1, 1.5)' }}>
                    0120-184-444
                </div>
            </div>
            <div className="text-center text-[0.8rem]">フェニックスホール</div>
            {(
                [
                    ['那覇玉泉院', '浦添市勢理客3-11-2', '名護玉泉院', '名護市宮里4-15-49'],
                    ['一日橋玉泉院', '那覇市上間388-1', '糸満玉泉院', '糸満市潮平799-1'],
                    ['具志川玉泉院', 'うるま市田場1060-1', 'やすらぎ会館玉泉', '沖縄市城前町1-34'],
                    ['西原玉泉院', '西原町字小那覇265-1', '小禄•豊見城玉泉院', '豊見城市字名嘉地401'],
                ] as const
            ).map(([name1, addr1, name2, addr2], i) => (
                <div
                    key={i}
                    className="grid gap-x-2 text-[0.5rem] leading-[1.25]"
                    style={{ gridTemplateColumns: '3.5rem 1fr 3.5rem 1fr' }}
                >
                    <div className="flex justify-between">
                        {name1.split('').map((c, j) => (
                            <span key={j}>{c}</span>
                        ))}
                    </div>
                    <div className="flex justify-between">
                        {addr1.split('').map((c, j) => (
                            <span key={j}>{c}</span>
                        ))}
                    </div>
                    <div className="flex justify-between">
                        {name2.split('').map((c, j) => (
                            <span key={j}>{c}</span>
                        ))}
                    </div>
                    <div className="flex justify-between">
                        {addr2.split('').map((c, j) => (
                            <span key={j}>{c}</span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
