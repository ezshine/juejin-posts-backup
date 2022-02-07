#!/usr/bin/env node
const axios = require("axios");
const fs = require("fs");
const inquirer = require('inquirer');
const TurndownService = require('turndown');
let mdService = new TurndownService();

let jj_userid;
let jj_username;

async function letUserInput(){
	await inquirer.prompt([
		{
			name:"输入要备份的掘金用户ID",
			type:"number",
			required:true,
			validate: function (input) {
			  var done = this.async();
	
			  getUserInfo(input,(res)=>{
				if(res.err_no!=0){
					done(res.err_msg);
				}else if(res.data.user_name){
					jj_userid = input;
					jj_username = res.data.user_name;
					done(null, true);
				}else done('没有找到对应用户');
			  })
			}
		  }
	  ]);

	  const res = await inquirer.prompt([
			{
				name:"确定要备份 "+jj_username+" 的全部文章吗？",
				type:"confirm",
				default:true
		  	}
	  ]);

	  if(Object.values(res)[0])getArticlesAfter(jj_userid);
}

async function getUserInfo(uid,cb){
	const res = await axios.request("https://api.juejin.cn/user_api/v1/user/get?user_id="+uid,{
		dataType:"json"
	})
	if(cb)cb(res.data);
}

async function getArticleDetail(article_id){
    const res = await axios.request("https://api.juejin.cn/content_api/v1/article/detail",{
        data:{
            article_id:article_id
        },
        headers:{
            "Content-Type":"application/json"
        },
        method:"POST",
        dataType:"json"
    })

    return res.data.data;
}

async function downloadArticleMarkdown(article_id){
    const res = await getArticleDetail(article_id);

	//有部分掘金文章的markdown里会有html标签，所以先做一次md转换
    let mark_content = mdService.turndown(res.article_info.mark_content);
    mark_content=mark_content.replace(/---[\n]theme.*[\n]---/g, "");
    mark_content=mark_content.replace(/\[\]\(\/\//g, "[](https://");

    if(!mark_content){
        console.log("此文章不是markdown，转换为markdown");
        mark_content = mdService.turndown(res.article_info.content);
    }

    if(!fs.existsSync('articles'))fs.mkdirSync('articles');

    try{
        fs.writeFileSync(`articles/${res.article_info.title}.md`,mark_content);
    }catch(err){
        fs.writeFileSync(`articles/${article_id}.md`,mark_content);
    }

    console.log("已下载");
}

async function getArticles(uid,cursor=0){
	const res = await axios.request("https://api.juejin.cn/content_api/v1/article/query_list",{
		data:{
			"cursor": cursor+'',
			"sort_type": 2,
			"user_id": uid+''
		},
		headers:{
			"Content-Type":"application/json"
		},
		method:"POST",
		dataType:"json"
	})
	
	return res.data.data;
}

function getArticlesAfter(uid,unixtime=0){
    //2955079655898093
	//1609430400
	
	let final_list = [];
	
	let dataByYear = {};
	
	let cursor = 0;
	
	async function getNextArticles(){
		let res = await getArticles(uid,cursor);
		
		if(!res)return dataByYear;
		
		let getTheLast = false;
		
		for(let i = 0;i<res.length;i++){
			var article_item = res[i];

            console.log(article_item.article_info.article_id,article_item.article_info.title);
            
            await downloadArticleMarkdown(article_item.article_info.article_id);

			if(article_item.article_info.ctime<unixtime){
				console.log('结束了，最后一篇是：');
				console.log(article_item.article_info.title);
				getTheLast=true;
				break;
			}else{
				if(article_item.article_info.ctime>1640966400)continue;
				
				var cDate = new Date(parseInt(article_item.article_info.ctime)*1000);
				var month = cDate.getMonth();
				
				if(!dataByYear[month])dataByYear[month]=[];
				
				var sItem = {
					title:article_item.article_info.title,
					author_name:article_item.author_user_info.user_name,
					article_id:article_item.article_info.article_id,
					view_count:article_item.article_info.view_count,
					digg_count:article_item.article_info.digg_count,
					comment_count:article_item.article_info.comment_count,
					ctime:article_item.article_info.ctime
				}
				
				dataByYear[month].push(sItem);
				
				final_list.push(sItem);
			}
		}
		
		cursor+=res.length;
		
		if(!getTheLast)return getNextArticles();
		else return dataByYear;
	}
	
	return getNextArticles();
}

// getArticlesAfter("2955079655898093");
// downloadArticleMarkdown("6888119217922113544");

letUserInput();